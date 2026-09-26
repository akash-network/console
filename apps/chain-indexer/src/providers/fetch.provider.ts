import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

export type Fetch = typeof fetch;

/** The global fetch behind a token, so services that scrape third parties can be handed a stub in tests. */
export const FETCH: InjectionToken<Fetch> = Symbol("FETCH");

container.register(FETCH, { useValue: fetch });
