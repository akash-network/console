import assert from "http-assert";

import type { Require } from "@src/core/types/require.type";
import type { UserOutput } from "@src/user/repositories";

export type PayingUser = Require<UserOutput, "stripeCustomerId">;

export function assertIsPayingUser<T extends UserOutput>(user: T): asserts user is T & PayingUser {
  assert(isPayingUser(user), 402, "User payments are not set up.");
}

export function isPayingUser<T extends UserOutput>(user: T): user is T & PayingUser {
  return !!user.stripeCustomerId;
}
