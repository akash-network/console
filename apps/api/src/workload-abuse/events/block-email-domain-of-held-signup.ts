import type { Job } from "@src/core";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import type { HeldSignupBlockEvidence } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";

export class BlockEmailDomainOfHeldSignup implements Job {
  static readonly [JOB_NAME] = "BlockEmailDomainOfHeldSignup";
  public readonly name = BlockEmailDomainOfHeldSignup[JOB_NAME];
  public readonly version = 1;

  constructor(
    public readonly data: {
      userId: UserOutput["id"];
      evidence: HeldSignupBlockEvidence;
    }
  ) {}
}

/** Keyed by user, since every retry of a held activation holds again and one pending evaluation per user is enough. */
export function blockEmailDomainOfHeldSignupKeyFor(userId: UserOutput["id"]): string {
  return `blockEmailDomainOfHeldSignup.${userId}`;
}
