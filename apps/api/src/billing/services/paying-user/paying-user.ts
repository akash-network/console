import type { Require } from "@src/core/types/require.type";
import type { UserOutput } from "@src/user/repositories";

export type PayingUser = Require<UserOutput, "stripeCustomerId">;

export function isPayingUser<T extends UserOutput>(user: T): user is T & PayingUser {
  return !!user.stripeCustomerId;
}
