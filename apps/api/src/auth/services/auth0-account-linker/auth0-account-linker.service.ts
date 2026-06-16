import type { GetUsers200ResponseOneOfInner, GetUsers200ResponseOneOfInnerIdentitiesInner } from "auth0";
import { singleton } from "tsyringe";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { CliPromptService } from "@src/core/services/cli-prompt/cli-prompt.service";

/**
 * Drives the interactive operator flow for folding a secondary Auth0 account
 * into a primary one. Auth0 only — it performs no console DB writes.
 */
@singleton()
export class Auth0AccountLinkerService {
  constructor(
    private readonly auth0Service: Auth0Service,
    private readonly prompt: CliPromptService
  ) {}

  /**
   * Prompts for a primary and a secondary account, prints a summary, and only
   * links after explicit confirmation. Closes the prompt interface in a finally
   * block.
   */
  async linkAccountsInteractively(): Promise<void> {
    try {
      const primary = await this.#promptAccount("primary");
      const secondary = await this.#promptAccount("secondary", primary.user_id);

      this.#printSummary(primary, secondary);

      const confirmed = await this.#confirm("Link these accounts?");
      if (!confirmed) {
        this.prompt.writeLine("Aborted. No changes made.");
        return;
      }

      const identity = this.#resolveRootIdentity(secondary);
      if (!identity?.provider || !identity.user_id) {
        throw new Error(`Secondary account ${secondary.user_id} has no usable identity to link`);
      }

      await this.auth0Service.linkUsers(primary.user_id as string, {
        provider: identity.provider,
        userId: String(identity.user_id)
      });

      this.prompt.writeLine(`\nLinked ${secondary.user_id} into ${primary.user_id}.`);
    } finally {
      this.prompt.close();
    }
  }

  /**
   * Prompts for an email, lists every matching Auth0 user, and returns the one
   * the operator picks. Re-prompts on no matches or an invalid selection. When
   * `excludeUserId` is set, rejects picking that same user (a user cannot link
   * to itself).
   */
  async #promptAccount(label: string, excludeUserId?: string): Promise<GetUsers200ResponseOneOfInner> {
    for (;;) {
      const email = (await this.prompt.question(`\nEnter the ${label} account email: `)).trim();
      if (!email) {
        this.prompt.writeLine("Email cannot be empty. Try again.");
        continue;
      }

      let users: GetUsers200ResponseOneOfInner[];
      try {
        users = await this.auth0Service.getUsersByEmail(email);
      } catch (error) {
        this.prompt.writeLine(`Lookup failed for "${email}": ${error instanceof Error ? error.message : String(error)}. Try again.`);
        continue;
      }

      if (users.length === 0) {
        this.prompt.writeLine(`No Auth0 users found for "${email}". Try again.`);
        continue;
      }

      this.prompt.writeLine(`\nMatches for ${label} (${email}):`);
      users.forEach((user, index) => this.prompt.writeLine(`  ${index + 1}) ${this.#describeAccount(user)}`));

      const choice = await this.#pickIndex(`Pick the ${label} account [1-${users.length}]: `, users.length);
      const selected = users[choice];

      if (excludeUserId && selected.user_id === excludeUserId) {
        this.prompt.writeLine("That is the same account as the primary. Pick a different one.");
        continue;
      }

      return selected;
    }
  }

  /**
   * Prompts repeatedly until the operator enters a valid 1-based index,
   * returning the corresponding 0-based array index.
   */
  async #pickIndex(prompt: string, count: number): Promise<number> {
    for (;;) {
      const raw = (await this.prompt.question(prompt)).trim();
      const index = Number(raw);

      if (Number.isInteger(index) && index >= 1 && index <= count) {
        return index - 1;
      }

      this.prompt.writeLine(`Enter a number between 1 and ${count}.`);
    }
  }

  /**
   * Returns the account's root identity — the one whose `provider|user_id`
   * reconstructs the top-level `user_id`. Auth0 stores the provider only in the
   * composite top-level id; `identities[].user_id` holds just the id portion, so
   * blindly taking `identities[0]` can pick the wrong identity once an account
   * has more than one linked.
   */
  #resolveRootIdentity(user: GetUsers200ResponseOneOfInner): GetUsers200ResponseOneOfInnerIdentitiesInner | undefined {
    return user.identities?.find(identity => `${identity.provider}|${identity.user_id}` === user.user_id);
  }

  /** Renders an account as `<connection> / <email> (<user_id>)` for list and summary output. */
  #describeAccount(user: GetUsers200ResponseOneOfInner): string {
    const connection = user.identities?.[0]?.connection ?? user.identities?.[0]?.provider ?? "unknown";
    return `${connection} / ${user.email ?? "no-email"} (${user.user_id})`;
  }

  /** Prints the primary/secondary summary block shown before the confirmation prompt. */
  #printSummary(primary: GetUsers200ResponseOneOfInner, secondary: GetUsers200ResponseOneOfInner): void {
    this.prompt.writeLine("\n--- Summary ---");
    this.prompt.writeLine(`Primary account:   ${this.#describeAccount(primary)}`);
    this.prompt.writeLine(`Secondary account: ${this.#describeAccount(secondary)}`);
    this.prompt.writeLine("The secondary account will be merged into the primary and will no longer exist on its own.\n");
  }

  /** Reads a y/N answer, treating only `y`/`yes` (case-insensitive) as confirmation. */
  async #confirm(prompt: string): Promise<boolean> {
    const answer = (await this.prompt.question(`${prompt} (y/N): `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  }
}
