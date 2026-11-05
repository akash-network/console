import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { AssistantPrivacy } from "@src/feedback/http-schemas/assistant-privacy.schema";
import { type AssistantConsentOutput, AssistantConsentRepository } from "@src/feedback/repositories/assistant-consent/assistant-consent.repository";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { UserRepository } from "@src/user/repositories";

export type AssistantConsentChange = { copyVersion: string; reviewOptIn: boolean };

function isUnchanged(latest: AssistantConsentOutput, change: AssistantConsentChange): boolean {
  return latest.copyVersion === change.copyVersion && latest.reviewOptIn === change.reviewOptIn;
}

@singleton()
export class AssistantConsentService {
  constructor(
    private readonly assistantConsentRepository: AssistantConsentRepository,
    private readonly assistantConversationRepository: AssistantConversationRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService
  ) {}

  async getPrivacy(): Promise<AssistantPrivacy> {
    const userId = this.authService.currentUser.id;
    const latest = await this.assistantConsentRepository.accessibleBy(this.authService.ability, "read").findLatestByUserId(userId);

    return await this.#privacyOf(userId, latest);
  }

  /** Keeps the agreement date while the copy version stays the same, so toggling the review opt-in does not look like a new agreement. */
  async updateConsent(change: AssistantConsentChange): Promise<AssistantPrivacy> {
    const userId = this.authService.currentUser.id;

    const consent = await this.txService.transaction(async () => {
      await this.userRepository.findOneByAndLock({ id: userId }, { strength: "no key update" });
      const latest = await this.assistantConsentRepository.findLatestByUserId(userId);

      if (latest && isUnchanged(latest, change)) return latest;

      return await this.assistantConsentRepository.accessibleBy(this.authService.ability, "create").create({
        userId,
        copyVersion: change.copyVersion,
        reviewOptIn: change.reviewOptIn,
        processingAcceptedAt: latest?.copyVersion === change.copyVersion ? latest.processingAcceptedAt : new Date()
      });
    });

    return await this.#privacyOf(userId, consent);
  }

  async #privacyOf(userId: string, consent: AssistantConsentOutput | undefined): Promise<AssistantPrivacy> {
    const storedConversationCount = await this.assistantConversationRepository.accessibleBy(this.authService.ability, "read").count({ userId });

    return {
      consent: consent
        ? {
            copyVersion: consent.copyVersion,
            processingAcceptedAt: consent.processingAcceptedAt.toISOString(),
            reviewOptIn: consent.reviewOptIn,
            updatedAt: consent.createdAt.toISOString()
          }
        : null,
      storedConversationCount
    };
  }
}
