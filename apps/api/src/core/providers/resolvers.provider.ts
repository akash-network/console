import type { InjectionToken } from "tsyringe";

import type { UserOutput } from "@src/user/repositories";

export interface Resolver {
  readonly key: string;
  resolve(user: UserOutput): Promise<unknown>;
}

export const DATA_RESOLVER: InjectionToken<Resolver> = Symbol("DATA_RESOLVER");
