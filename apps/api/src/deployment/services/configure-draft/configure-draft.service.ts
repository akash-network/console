import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { ConfigureDraftContent } from "@src/deployment/model-schemas";
import { type ConfigureDraftOutput, ConfigureDraftRepository } from "@src/deployment/repositories/configure-draft/configure-draft.repository";
import {
  configureDraftExpiryOf,
  ExpireConfigureDraft,
  expireConfigureDraftKeyFor
} from "@src/deployment/services/expire-configure-draft/expire-configure-draft.handler";

/** Matches what the browser kept before drafts moved to the account. */
export const MAX_CONFIGURE_DRAFTS_PER_USER = 20;

@singleton()
export class ConfigureDraftService {
  constructor(
    private readonly configureDraftRepository: ConfigureDraftRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService
  ) {}

  /** A draft past its expiry is answered as missing even before the job that removes it has run. */
  async get(draftId: string): Promise<ConfigureDraftOutput> {
    const draft = await this.configureDraftRepository.accessibleBy(this.authService.ability, "read").findByDraftId(draftId);
    if (!draft || configureDraftExpiryOf(draft.updatedAt) <= new Date()) throw createError(404, "Draft not found");

    return draft;
  }

  async save(draftId: string, content: ConfigureDraftContent): Promise<ConfigureDraftOutput> {
    const userId = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      const { draft, isNew } = await this.configureDraftRepository
        .accessibleBy(this.authService.ability, "create")
        .createOrReplace({ userId, draftId, content });
      if (!isNew) return draft;

      await this.configureDraftRepository.deleteAllButNewest(userId, MAX_CONFIGURE_DRAFTS_PER_USER);
      await this.jobQueueService.enqueue(new ExpireConfigureDraft({ configureDraftId: draft.id }), {
        singletonKey: expireConfigureDraftKeyFor(draft.id),
        startAfter: configureDraftExpiryOf(draft.updatedAt).toISOString()
      });

      return draft;
    });
  }

  async delete(draftId: string): Promise<void> {
    await this.configureDraftRepository.accessibleBy(this.authService.ability, "delete").deleteBy({ draftId });
  }
}
