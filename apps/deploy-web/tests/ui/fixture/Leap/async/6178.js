!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      o = new e.Error().stack;
    o &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[o] = "bceda5aa-a712-4048-9930-96fbdfafff65"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-bceda5aa-a712-4048-9930-96fbdfafff65"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["6178"],
  {
    1149: function (e, o, r) {
      r.r(o),
        r.d(o, {
          QueryDelegatorRewardsListDesc: () => U,
          QueryParamsDesc: () => _,
          QueryDesc: () => J,
          QueryDelegatorRewardsDesc: () => T,
          QueryProviderDelegatorsDesc: () => Q,
          GrpcWebImpl: () => B,
          QueryClientImpl: () => M,
          QueryDelegatorProvidersDesc: () => R
        });
      var t = r(85772),
        i = r(42337),
        n = r(80059),
        a = r(13779),
        d = r(25342);
      function l() {
        return { provider: "", chainID: "", delegator: "", amount: a.sN.fromPartial({}), timestamp: BigInt(0) };
      }
      let s = {
        typeUrl: "/lavanet.lava.dualstaking.Delegation",
        encode: (e, o = n.Lt.create()) => (
          "" !== e.provider && o.uint32(10).string(e.provider),
          "" !== e.chainID && o.uint32(18).string(e.chainID),
          "" !== e.delegator && o.uint32(26).string(e.delegator),
          void 0 !== e.amount && a.sN.encode(e.amount, o.uint32(34).fork()).ldelim(),
          e.timestamp !== BigInt(0) && o.uint32(40).int64(e.timestamp),
          o
        ),
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = l();
          for (; r.pos < t; ) {
            let e = r.uint32();
            switch (e >>> 3) {
              case 1:
                i.provider = r.string();
                break;
              case 2:
                i.chainID = r.string();
                break;
              case 3:
                i.delegator = r.string();
                break;
              case 4:
                i.amount = a.sN.decode(r, r.uint32());
                break;
              case 5:
                i.timestamp = r.int64();
                break;
              default:
                r.skipType(7 & e);
            }
          }
          return i;
        },
        fromJSON: e => ({
          provider: (0, d.DM)(e.provider) ? String(e.provider) : "",
          chainID: (0, d.DM)(e.chainID) ? String(e.chainID) : "",
          delegator: (0, d.DM)(e.delegator) ? String(e.delegator) : "",
          amount: (0, d.DM)(e.amount) ? a.sN.fromJSON(e.amount) : a.sN.fromJSON({ amount: 1, denom: "" }),
          timestamp: (0, d.DM)(e.timestamp) ? BigInt(e.timestamp.toString()) : BigInt(0)
        }),
        toJSON(e) {
          let o = {};
          return (
            void 0 !== e.provider && (o.provider = e.provider),
            void 0 !== e.chainID && (o.chainID = e.chainID),
            void 0 !== e.delegator && (o.delegator = e.delegator),
            void 0 !== e.amount && (o.amount = e.amount ? a.sN.toJSON(e.amount) : void 0),
            void 0 !== e.timestamp && (o.timestamp = (e.timestamp || BigInt(0)).toString()),
            o
          );
        },
        fromPartial(e) {
          var o, r, t;
          let i = l();
          return (
            (i.provider = null !== (o = e.provider) && void 0 !== o ? o : ""),
            (i.chainID = null !== (r = e.chainID) && void 0 !== r ? r : ""),
            (i.delegator = null !== (t = e.delegator) && void 0 !== t ? t : ""),
            (i.amount = void 0 !== e.amount && null !== e.amount ? a.sN.fromPartial(e.amount) : a.sN.fromJSON({ amount: 1, denom: "" })),
            (i.timestamp = void 0 !== e.timestamp && null !== e.timestamp ? BigInt(e.timestamp.toString()) : BigInt(0)),
            i
          );
        },
        fromAmino(e) {
          let o = l();
          return (
            void 0 !== e.provider && null !== e.provider && (o.provider = e.provider),
            void 0 !== e.chainID && null !== e.chainID && (o.chainID = e.chainID),
            void 0 !== e.delegator && null !== e.delegator && (o.delegator = e.delegator),
            void 0 !== e.amount && null !== e.amount && (o.amount = a.sN.fromAmino(e.amount)),
            void 0 !== e.timestamp && null !== e.timestamp && (o.timestamp = BigInt(e.timestamp)),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.provider = "" === e.provider ? void 0 : e.provider),
            (o.chainID = "" === e.chainID ? void 0 : e.chainID),
            (o.delegator = "" === e.delegator ? void 0 : e.delegator),
            (o.amount = e.amount ? a.sN.toAmino(e.amount) : void 0),
            (o.timestamp = e.timestamp !== BigInt(0) ? e.timestamp.toString() : void 0),
            o
          );
        },
        fromAminoMsg: e => s.fromAmino(e.value),
        fromProtoMsg: e => s.decode(e.value),
        toProto: e => s.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.Delegation", value: s.encode(e).finish() })
      };
      function m() {
        return { minSelfDelegation: a.sN.fromPartial({}) };
      }
      let u = {
          typeUrl: "/lavanet.lava.dualstaking.Params",
          encode: (e, o = n.Lt.create()) => (void 0 !== e.minSelfDelegation && a.sN.encode(e.minSelfDelegation, o.uint32(10).fork()).ldelim(), o),
          decode(e, o) {
            let r = e instanceof n.oP ? e : new n.oP(e),
              t = void 0 === o ? r.len : r.pos + o,
              i = m();
            for (; r.pos < t; ) {
              let e = r.uint32();
              e >>> 3 == 1 ? (i.minSelfDelegation = a.sN.decode(r, r.uint32())) : r.skipType(7 & e);
            }
            return i;
          },
          fromJSON: e => ({ minSelfDelegation: (0, d.DM)(e.minSelfDelegation) ? a.sN.fromJSON(e.minSelfDelegation) : a.sN.fromJSON({ amount: 1, denom: "" }) }),
          toJSON(e) {
            let o = {};
            return void 0 !== e.minSelfDelegation && (o.minSelfDelegation = e.minSelfDelegation ? a.sN.toJSON(e.minSelfDelegation) : void 0), o;
          },
          fromPartial(e) {
            let o = m();
            return (
              (o.minSelfDelegation =
                void 0 !== e.minSelfDelegation && null !== e.minSelfDelegation
                  ? a.sN.fromPartial(e.minSelfDelegation)
                  : a.sN.fromJSON({ amount: 1, denom: "" })),
              o
            );
          },
          fromAmino(e) {
            let o = m();
            return void 0 !== e.min_self_delegation && null !== e.min_self_delegation && (o.minSelfDelegation = a.sN.fromAmino(e.min_self_delegation)), o;
          },
          toAmino(e) {
            let o = {};
            return (o.min_self_delegation = e.minSelfDelegation ? a.sN.toAmino(e.minSelfDelegation) : void 0), o;
          },
          fromAminoMsg: e => u.fromAmino(e.value),
          fromProtoMsg: e => u.decode(e.value),
          toProto: e => u.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.Params", value: u.encode(e).finish() })
        },
        g = {
          typeUrl: "/lavanet.lava.dualstaking.QueryParamsRequest",
          encode: (e, o = n.Lt.create()) => o,
          decode(e, o) {
            let r = e instanceof n.oP ? e : new n.oP(e),
              t = void 0 === o ? r.len : r.pos + o;
            for (; r.pos < t; ) {
              let e = r.uint32();
              r.skipType(7 & e);
            }
            return {};
          },
          fromJSON: e => ({}),
          toJSON: e => ({}),
          fromPartial: e => ({}),
          fromAmino: e => ({}),
          toAmino: e => ({}),
          fromAminoMsg: e => g.fromAmino(e.value),
          fromProtoMsg: e => g.decode(e.value),
          toProto: e => g.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryParamsRequest", value: g.encode(e).finish() })
        };
      function v() {
        return { params: u.fromPartial({}) };
      }
      let p = {
        typeUrl: "/lavanet.lava.dualstaking.QueryParamsResponse",
        encode: (e, o = n.Lt.create()) => (void 0 !== e.params && u.encode(e.params, o.uint32(10).fork()).ldelim(), o),
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = v();
          for (; r.pos < t; ) {
            let e = r.uint32();
            e >>> 3 == 1 ? (i.params = u.decode(r, r.uint32())) : r.skipType(7 & e);
          }
          return i;
        },
        fromJSON: e => ({ params: ((0, d.DM)(e.params), u.fromJSON(e.params)) }),
        toJSON(e) {
          let o = {};
          return void 0 !== e.params && (o.params = e.params ? u.toJSON(e.params) : void 0), o;
        },
        fromPartial(e) {
          let o = v();
          return (o.params = void 0 !== e.params && null !== e.params ? u.fromPartial(e.params) : u.fromJSON(e.params)), o;
        },
        fromAmino(e) {
          let o = v();
          return void 0 !== e.params && null !== e.params && (o.params = u.fromAmino(e.params)), o;
        },
        toAmino(e) {
          let o = {};
          return (o.params = e.params ? u.toAmino(e.params) : void 0), o;
        },
        fromAminoMsg: e => p.fromAmino(e.value),
        fromProtoMsg: e => p.decode(e.value),
        toProto: e => p.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryParamsResponse", value: p.encode(e).finish() })
      };
      function c() {
        return { delegator: "", withPending: !1 };
      }
      let f = {
        typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorProvidersRequest",
        encode: (e, o = n.Lt.create()) => ("" !== e.delegator && o.uint32(10).string(e.delegator), !0 === e.withPending && o.uint32(16).bool(e.withPending), o),
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = c();
          for (; r.pos < t; ) {
            let e = r.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegator = r.string();
                break;
              case 2:
                i.withPending = r.bool();
                break;
              default:
                r.skipType(7 & e);
            }
          }
          return i;
        },
        fromJSON: e => ({ delegator: (0, d.DM)(e.delegator) ? String(e.delegator) : "", withPending: !!(0, d.DM)(e.withPending) && !!e.withPending }),
        toJSON(e) {
          let o = {};
          return void 0 !== e.delegator && (o.delegator = e.delegator), void 0 !== e.withPending && (o.withPending = e.withPending), o;
        },
        fromPartial(e) {
          var o, r;
          let t = c();
          return (t.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""), (t.withPending = null !== (r = e.withPending) && void 0 !== r && r), t;
        },
        fromAmino(e) {
          let o = c();
          return (
            void 0 !== e.delegator && null !== e.delegator && (o.delegator = e.delegator),
            void 0 !== e.with_pending && null !== e.with_pending && (o.withPending = e.with_pending),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (o.delegator = "" === e.delegator ? void 0 : e.delegator), (o.with_pending = !1 === e.withPending ? void 0 : e.withPending), o;
        },
        fromAminoMsg: e => f.fromAmino(e.value),
        fromProtoMsg: e => f.decode(e.value),
        toProto: e => f.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorProvidersRequest", value: f.encode(e).finish() })
      };
      function h() {
        return { delegations: [] };
      }
      let P = {
        typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorProvidersResponse",
        encode(e, o = n.Lt.create()) {
          for (let r of e.delegations) s.encode(r, o.uint32(10).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = h();
          for (; r.pos < t; ) {
            let e = r.uint32();
            e >>> 3 == 1 ? i.delegations.push(s.decode(r, r.uint32())) : r.skipType(7 & e);
          }
          return i;
        },
        fromJSON: e => ({ delegations: Array.isArray(null == e ? void 0 : e.delegations) ? e.delegations.map(e => s.fromJSON(e)) : [] }),
        toJSON(e) {
          let o = {};
          return e.delegations ? (o.delegations = e.delegations.map(e => (e ? s.toJSON(e) : void 0))) : (o.delegations = []), o;
        },
        fromPartial(e) {
          var o;
          let r = h();
          return (r.delegations = (null === (o = e.delegations) || void 0 === o ? void 0 : o.map(e => s.fromPartial(e))) || []), r;
        },
        fromAmino(e) {
          var o;
          let r = h();
          return (r.delegations = (null === (o = e.delegations) || void 0 === o ? void 0 : o.map(e => s.fromAmino(e))) || []), r;
        },
        toAmino(e) {
          let o = {};
          return e.delegations ? (o.delegations = e.delegations.map(e => (e ? s.toAmino(e) : void 0))) : (o.delegations = e.delegations), o;
        },
        fromAminoMsg: e => P.fromAmino(e.value),
        fromProtoMsg: e => P.decode(e.value),
        toProto: e => P.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorProvidersResponse", value: P.encode(e).finish() })
      };
      function y() {
        return { provider: "", withPending: !1 };
      }
      let w = {
        typeUrl: "/lavanet.lava.dualstaking.QueryProviderDelegatorsRequest",
        encode: (e, o = n.Lt.create()) => ("" !== e.provider && o.uint32(10).string(e.provider), !0 === e.withPending && o.uint32(16).bool(e.withPending), o),
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = y();
          for (; r.pos < t; ) {
            let e = r.uint32();
            switch (e >>> 3) {
              case 1:
                i.provider = r.string();
                break;
              case 2:
                i.withPending = r.bool();
                break;
              default:
                r.skipType(7 & e);
            }
          }
          return i;
        },
        fromJSON: e => ({ provider: (0, d.DM)(e.provider) ? String(e.provider) : "", withPending: !!(0, d.DM)(e.withPending) && !!e.withPending }),
        toJSON(e) {
          let o = {};
          return void 0 !== e.provider && (o.provider = e.provider), void 0 !== e.withPending && (o.withPending = e.withPending), o;
        },
        fromPartial(e) {
          var o, r;
          let t = y();
          return (t.provider = null !== (o = e.provider) && void 0 !== o ? o : ""), (t.withPending = null !== (r = e.withPending) && void 0 !== r && r), t;
        },
        fromAmino(e) {
          let o = y();
          return (
            void 0 !== e.provider && null !== e.provider && (o.provider = e.provider),
            void 0 !== e.with_pending && null !== e.with_pending && (o.withPending = e.with_pending),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (o.provider = "" === e.provider ? void 0 : e.provider), (o.with_pending = !1 === e.withPending ? void 0 : e.withPending), o;
        },
        fromAminoMsg: e => w.fromAmino(e.value),
        fromProtoMsg: e => w.decode(e.value),
        toProto: e => w.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryProviderDelegatorsRequest", value: w.encode(e).finish() })
      };
      function D() {
        return { delegations: [] };
      }
      let S = {
        typeUrl: "/lavanet.lava.dualstaking.QueryProviderDelegatorsResponse",
        encode(e, o = n.Lt.create()) {
          for (let r of e.delegations) s.encode(r, o.uint32(10).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = D();
          for (; r.pos < t; ) {
            let e = r.uint32();
            e >>> 3 == 1 ? i.delegations.push(s.decode(r, r.uint32())) : r.skipType(7 & e);
          }
          return i;
        },
        fromJSON: e => ({ delegations: Array.isArray(null == e ? void 0 : e.delegations) ? e.delegations.map(e => s.fromJSON(e)) : [] }),
        toJSON(e) {
          let o = {};
          return e.delegations ? (o.delegations = e.delegations.map(e => (e ? s.toJSON(e) : void 0))) : (o.delegations = []), o;
        },
        fromPartial(e) {
          var o;
          let r = D();
          return (r.delegations = (null === (o = e.delegations) || void 0 === o ? void 0 : o.map(e => s.fromPartial(e))) || []), r;
        },
        fromAmino(e) {
          var o;
          let r = D();
          return (r.delegations = (null === (o = e.delegations) || void 0 === o ? void 0 : o.map(e => s.fromAmino(e))) || []), r;
        },
        toAmino(e) {
          let o = {};
          return e.delegations ? (o.delegations = e.delegations.map(e => (e ? s.toAmino(e) : void 0))) : (o.delegations = e.delegations), o;
        },
        fromAminoMsg: e => S.fromAmino(e.value),
        fromProtoMsg: e => S.decode(e.value),
        toProto: e => S.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryProviderDelegatorsResponse", value: S.encode(e).finish() })
      };
      function N() {
        return { delegator: "", provider: "", chainId: "" };
      }
      let A = {
        typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorRewardsRequest",
        encode: (e, o = n.Lt.create()) => (
          "" !== e.delegator && o.uint32(10).string(e.delegator),
          "" !== e.provider && o.uint32(18).string(e.provider),
          "" !== e.chainId && o.uint32(26).string(e.chainId),
          o
        ),
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = N();
          for (; r.pos < t; ) {
            let e = r.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegator = r.string();
                break;
              case 2:
                i.provider = r.string();
                break;
              case 3:
                i.chainId = r.string();
                break;
              default:
                r.skipType(7 & e);
            }
          }
          return i;
        },
        fromJSON: e => ({
          delegator: (0, d.DM)(e.delegator) ? String(e.delegator) : "",
          provider: (0, d.DM)(e.provider) ? String(e.provider) : "",
          chainId: (0, d.DM)(e.chainId) ? String(e.chainId) : ""
        }),
        toJSON(e) {
          let o = {};
          return (
            void 0 !== e.delegator && (o.delegator = e.delegator),
            void 0 !== e.provider && (o.provider = e.provider),
            void 0 !== e.chainId && (o.chainId = e.chainId),
            o
          );
        },
        fromPartial(e) {
          var o, r, t;
          let i = N();
          return (
            (i.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""),
            (i.provider = null !== (r = e.provider) && void 0 !== r ? r : ""),
            (i.chainId = null !== (t = e.chainId) && void 0 !== t ? t : ""),
            i
          );
        },
        fromAmino(e) {
          let o = N();
          return (
            void 0 !== e.delegator && null !== e.delegator && (o.delegator = e.delegator),
            void 0 !== e.provider && null !== e.provider && (o.provider = e.provider),
            void 0 !== e.chain_id && null !== e.chain_id && (o.chainId = e.chain_id),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.delegator = "" === e.delegator ? void 0 : e.delegator),
            (o.provider = "" === e.provider ? void 0 : e.provider),
            (o.chain_id = "" === e.chainId ? void 0 : e.chainId),
            o
          );
        },
        fromAminoMsg: e => A.fromAmino(e.value),
        fromProtoMsg: e => A.decode(e.value),
        toProto: e => A.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorRewardsRequest", value: A.encode(e).finish() })
      };
      function I() {
        return { rewards: [] };
      }
      let b = {
        typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorRewardsResponse",
        encode(e, o = n.Lt.create()) {
          for (let r of e.rewards) O.encode(r, o.uint32(10).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = I();
          for (; r.pos < t; ) {
            let e = r.uint32();
            e >>> 3 == 1 ? i.rewards.push(O.decode(r, r.uint32())) : r.skipType(7 & e);
          }
          return i;
        },
        fromJSON: e => ({ rewards: Array.isArray(null == e ? void 0 : e.rewards) ? e.rewards.map(e => O.fromJSON(e)) : [] }),
        toJSON(e) {
          let o = {};
          return e.rewards ? (o.rewards = e.rewards.map(e => (e ? O.toJSON(e) : void 0))) : (o.rewards = []), o;
        },
        fromPartial(e) {
          var o;
          let r = I();
          return (r.rewards = (null === (o = e.rewards) || void 0 === o ? void 0 : o.map(e => O.fromPartial(e))) || []), r;
        },
        fromAmino(e) {
          var o;
          let r = I();
          return (r.rewards = (null === (o = e.rewards) || void 0 === o ? void 0 : o.map(e => O.fromAmino(e))) || []), r;
        },
        toAmino(e) {
          let o = {};
          return e.rewards ? (o.rewards = e.rewards.map(e => (e ? O.toAmino(e) : void 0))) : (o.rewards = e.rewards), o;
        },
        fromAminoMsg: e => b.fromAmino(e.value),
        fromProtoMsg: e => b.decode(e.value),
        toProto: e => b.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.QueryDelegatorRewardsResponse", value: b.encode(e).finish() })
      };
      function k() {
        return { provider: "", chainId: "", amount: [] };
      }
      let O = {
        typeUrl: "/lavanet.lava.dualstaking.DelegatorRewardInfo",
        encode(e, o = n.Lt.create()) {
          for (let r of ("" !== e.provider && o.uint32(10).string(e.provider), "" !== e.chainId && o.uint32(18).string(e.chainId), e.amount))
            a.sN.encode(r, o.uint32(26).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let r = e instanceof n.oP ? e : new n.oP(e),
            t = void 0 === o ? r.len : r.pos + o,
            i = k();
          for (; r.pos < t; ) {
            let e = r.uint32();
            switch (e >>> 3) {
              case 1:
                i.provider = r.string();
                break;
              case 2:
                i.chainId = r.string();
                break;
              case 3:
                i.amount.push(a.sN.decode(r, r.uint32()));
                break;
              default:
                r.skipType(7 & e);
            }
          }
          return i;
        },
        fromJSON: e => ({
          provider: (0, d.DM)(e.provider) ? String(e.provider) : "",
          chainId: (0, d.DM)(e.chainId) ? String(e.chainId) : "",
          amount: Array.isArray(null == e ? void 0 : e.amount) ? e.amount.map(e => a.sN.fromJSON(e)) : []
        }),
        toJSON(e) {
          let o = {};
          return (
            void 0 !== e.provider && (o.provider = e.provider),
            void 0 !== e.chainId && (o.chainId = e.chainId),
            e.amount ? (o.amount = e.amount.map(e => (e ? a.sN.toJSON(e) : void 0))) : (o.amount = []),
            o
          );
        },
        fromPartial(e) {
          var o, r, t;
          let i = k();
          return (
            (i.provider = null !== (o = e.provider) && void 0 !== o ? o : ""),
            (i.chainId = null !== (r = e.chainId) && void 0 !== r ? r : ""),
            (i.amount = (null === (t = e.amount) || void 0 === t ? void 0 : t.map(e => a.sN.fromPartial(e))) || []),
            i
          );
        },
        fromAmino(e) {
          var o;
          let r = k();
          return (
            void 0 !== e.provider && null !== e.provider && (r.provider = e.provider),
            void 0 !== e.chain_id && null !== e.chain_id && (r.chainId = e.chain_id),
            (r.amount = (null === (o = e.amount) || void 0 === o ? void 0 : o.map(e => a.sN.fromAmino(e))) || []),
            r
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.provider = "" === e.provider ? void 0 : e.provider),
            (o.chain_id = "" === e.chainId ? void 0 : e.chainId),
            e.amount ? (o.amount = e.amount.map(e => (e ? a.sN.toAmino(e) : void 0))) : (o.amount = e.amount),
            o
          );
        },
        fromAminoMsg: e => O.fromAmino(e.value),
        fromProtoMsg: e => O.decode(e.value),
        toProto: e => O.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/lavanet.lava.dualstaking.DelegatorRewardInfo", value: O.encode(e).finish() })
      };
      class M {
        constructor(e) {
          (this.rpc = e),
            (this.params = this.params.bind(this)),
            (this.delegatorProviders = this.delegatorProviders.bind(this)),
            (this.providerDelegators = this.providerDelegators.bind(this)),
            (this.delegatorRewards = this.delegatorRewards.bind(this)),
            (this.delegatorRewardsList = this.delegatorRewardsList.bind(this));
        }
        params(e = {}, o) {
          return this.rpc.unary(_, g.fromPartial(e), o);
        }
        delegatorProviders(e, o) {
          return this.rpc.unary(R, f.fromPartial(e), o);
        }
        providerDelegators(e, o) {
          return this.rpc.unary(Q, w.fromPartial(e), o);
        }
        delegatorRewards(e, o) {
          return this.rpc.unary(T, A.fromPartial(e), o);
        }
        delegatorRewardsList(e, o) {
          return this.rpc.unary(U, A.fromPartial(e), o);
        }
      }
      let J = { serviceName: "lavanet.lava.dualstaking.Query" },
        _ = {
          methodName: "Params",
          service: J,
          requestStream: !1,
          responseStream: !1,
          requestType: {
            serializeBinary() {
              return g.encode(this).finish();
            }
          },
          responseType: {
            deserializeBinary: e =>
              Object.assign(Object.assign({}, p.decode(e)), {
                toObject() {
                  return this;
                }
              })
          }
        },
        R = {
          methodName: "DelegatorProviders",
          service: J,
          requestStream: !1,
          responseStream: !1,
          requestType: {
            serializeBinary() {
              return f.encode(this).finish();
            }
          },
          responseType: {
            deserializeBinary: e =>
              Object.assign(Object.assign({}, P.decode(e)), {
                toObject() {
                  return this;
                }
              })
          }
        },
        Q = {
          methodName: "ProviderDelegators",
          service: J,
          requestStream: !1,
          responseStream: !1,
          requestType: {
            serializeBinary() {
              return w.encode(this).finish();
            }
          },
          responseType: {
            deserializeBinary: e =>
              Object.assign(Object.assign({}, S.decode(e)), {
                toObject() {
                  return this;
                }
              })
          }
        },
        T = {
          methodName: "DelegatorRewards",
          service: J,
          requestStream: !1,
          responseStream: !1,
          requestType: {
            serializeBinary() {
              return A.encode(this).finish();
            }
          },
          responseType: {
            deserializeBinary: e =>
              Object.assign(Object.assign({}, b.decode(e)), {
                toObject() {
                  return this;
                }
              })
          }
        },
        U = {
          methodName: "DelegatorRewardsList",
          service: J,
          requestStream: !1,
          responseStream: !1,
          requestType: {
            serializeBinary() {
              return A.encode(this).finish();
            }
          },
          responseType: {
            deserializeBinary: e =>
              Object.assign(Object.assign({}, b.decode(e)), {
                toObject() {
                  return this;
                }
              })
          }
        };
      class B {
        constructor(e, o) {
          (this.host = e), (this.options = o);
        }
        unary(e, o, r) {
          var n;
          let a = Object.assign(Object.assign({}, o), e.requestType),
            d =
              r && this.options.metadata
                ? new i.BrowserHeaders(
                    Object.assign(
                      Object.assign({}, null === (n = this.options) || void 0 === n ? void 0 : n.metadata.headersMap),
                      null == r ? void 0 : r.headersMap
                    )
                  )
                : r || this.options.metadata;
          return new Promise((o, r) => {
            t.grpc.unary(e, {
              request: a,
              host: this.host,
              metadata: d,
              transport: this.options.transport,
              debug: this.options.debug,
              onEnd: function (e) {
                if (e.status === t.grpc.Code.OK) o(e.message);
                else {
                  let o = Error(e.statusMessage);
                  (o.code = e.status), (o.metadata = e.trailers), r(o);
                }
              }
            });
          });
        }
      }
    }
  }
]);
//# sourceMappingURL=6178.js.map
