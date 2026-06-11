export { sdk } from "./instrumentation";
export type * from "@opentelemetry/api";
// `export *` of runtime values is NOT statically analyzable here because "@opentelemetry/api" is
// external in app bundles. tsup's experimental CJS code-splitting converts the resulting namespace
// re-export with a positional `require` that runs after `__reExport`, so every re-exported binding
// ends up undefined at runtime. Keep these value re-exports explicit.
export {
  baggageEntryMetadataFromString,
  context,
  createContextKey,
  createNoopMeter,
  createTraceState,
  defaultTextMapGetter,
  defaultTextMapSetter,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  INVALID_SPAN_CONTEXT,
  INVALID_SPANID,
  INVALID_TRACEID,
  isSpanContextValid,
  isValidSpanId,
  isValidTraceId,
  metrics,
  propagation,
  ProxyTracer,
  ProxyTracerProvider,
  ROOT_CONTEXT,
  SamplingDecision,
  SpanKind,
  SpanStatusCode,
  trace,
  TraceFlags,
  ValueType
} from "@opentelemetry/api";
export * from "./util/tracing/tracing.util";
