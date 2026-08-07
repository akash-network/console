export * from "./dashboard";
export * from "./block";
export * from "./transaction";
export * from "./address";
export * from "./snapshots";
export * from "./sdlBuilder";
export * from "./billing";
export * from "./templates";
export * from "./providerAttributes";
export * from "./balances";
export * from "./errors";

export type PaginatedResults<T> = {
  results: T[];
  count: number;
};
