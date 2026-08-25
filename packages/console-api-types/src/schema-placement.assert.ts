import type { operations } from "./schema";

/**
 * Guards which operation carries `consoleSettings` in the generated schema.
 *
 * `getDeployment`, `updateDeployment`, `depositDeployment` and `createLease` all answer with the same
 * inline deployment shape, so their generated blocks are byte-identical for hundreds of lines. A field
 * added to that schema by hand, or by any patch that matches on surrounding context rather than on the
 * operation it belongs to, can land on the wrong one and still compile, still appear exactly once, and
 * still satisfy `validate:types` — none of which is sensitive to *which* operation it landed on. That
 * is not hypothetical: it happened, and nothing but a positional check caught it.
 *
 * Only the read carries what the console recorded for a deployment. The three that write never return it,
 * so promising it there would have TypeScript describe a property that is `undefined` at runtime.
 */
type OkResponseData<T> = T extends { responses: { 200: { content: { "application/json": { data: infer D } } } } } ? D : never;

type Carries<T, K extends string> = K extends keyof OkResponseData<T> ? true : false;

type Resolves<T> = [OkResponseData<T>] extends [never] ? false : true;

type Asserts<T extends true> = T;
type Refutes<T extends false> = T;

export type ConsoleSettingsIsOnTheDeploymentRead = Asserts<Carries<operations["getDeployment"], "consoleSettings">>;
export type ConsoleSettingsIsNotOnTheDeploymentUpdate = Refutes<Carries<operations["updateDeployment"], "consoleSettings">>;
export type ConsoleSettingsIsNotOnTheDeposit = Refutes<Carries<operations["depositDeployment"], "consoleSettings">>;
export type ConsoleSettingsIsNotOnTheLeaseCreate = Refutes<Carries<operations["createLease"], "consoleSettings">>;

/**
 * `Carries` answers on `keyof`, which degrades in two opposite directions, so neither check below is
 * redundant with the other and neither is redundant with the four above.
 *
 * An extraction that matches nothing yields `never`, and `keyof never` is `string | number | symbol`, so
 * every key appears present. The three `Refutes` are what fail then — the read's own assertions would
 * pass for the wrong reason. `Resolves` is therefore the only thing standing between a `getDeployment`
 * that stops resolving on its own and a file that compiles green while guarding nothing.
 *
 * An extraction that matches but is keyless — `data: unknown`, say — yields `keyof` of `never`, so every
 * key appears absent and the three `Refutes` pass vacuously. The `escrow_account` probes are what fail
 * then, on a key every deployment response has always had.
 */
export type TheDeploymentReadResolves = Asserts<Resolves<operations["getDeployment"]>>;

export type TheDeploymentReadIsKeyed = Asserts<Carries<operations["getDeployment"], "escrow_account">>;
export type TheDeploymentUpdateIsKeyed = Asserts<Carries<operations["updateDeployment"], "escrow_account">>;
export type TheDepositIsKeyed = Asserts<Carries<operations["depositDeployment"], "escrow_account">>;
export type TheLeaseCreateIsKeyed = Asserts<Carries<operations["createLease"], "escrow_account">>;
