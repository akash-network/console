import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { generateAffiliateCode, normalizeAffiliateCode } from "@src/affiliate/lib/affiliate-code/affiliate-code";
import { type AffiliateOutput, AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { UserRepository } from "@src/user/repositories";

const MAX_GENERATED_CODE_ATTEMPTS = 5;

export type ApproveAffiliateInput = { userId?: string; email?: string; code?: string; actor: string };
export type RevokeAffiliateInput = { code: string; actor: string };

@singleton()
export class AffiliateService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly affiliateRepository: AffiliateRepository,
    private readonly userRepository: UserRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AffiliateService.name });
  }

  async approve({ userId, email, code, actor }: ApproveAffiliateInput): Promise<AffiliateOutput> {
    const resolvedUserId = await this.#resolveUserId({ userId, email });
    const normalizedCode = code !== undefined ? this.#requireValidCode(code) : undefined;
    const existing = await this.affiliateRepository.findByUserId(resolvedUserId);

    if (existing && !existing.revokedAt) {
      throw createError(409, "This user is already an approved affiliate", { errorCode: "affiliate_already_approved" });
    }

    if (normalizedCode) await this.#assertCodeAvailable(normalizedCode, existing?.id);

    const approvedAt = new Date();
    const affiliate = existing
      ? await this.affiliateRepository.updateById(
          existing.id,
          { code: normalizedCode ?? existing.code, approvedAt, approvedBy: actor, revokedAt: null, revokedBy: null },
          { returning: true }
        )
      : await this.#createWithCode({ userId: resolvedUserId, code: normalizedCode, approvedAt, actor });

    this.logger.info({ event: "AFFILIATE_APPROVED", actor, userId: resolvedUserId, code: affiliate.code });

    return affiliate;
  }

  async revoke({ code, actor }: RevokeAffiliateInput): Promise<AffiliateOutput> {
    const normalizedCode = normalizeAffiliateCode(code);
    const affiliate = normalizedCode ? await this.affiliateRepository.findByCode(normalizedCode) : undefined;

    if (!affiliate) throw createError(404, "No affiliate with this code was found", { errorCode: "affiliate_not_found" });
    if (affiliate.revokedAt) return affiliate;

    const revoked = await this.affiliateRepository.updateById(affiliate.id, { revokedAt: new Date(), revokedBy: actor }, { returning: true });

    this.logger.info({ event: "AFFILIATE_REVOKED", actor, userId: affiliate.userId, code: affiliate.code });

    return revoked;
  }

  async findActiveByCode(rawCode: string): Promise<AffiliateOutput | undefined> {
    const normalizedCode = normalizeAffiliateCode(rawCode);
    if (!normalizedCode) return undefined;

    const affiliate = await this.affiliateRepository.findByCode(normalizedCode);
    return affiliate && !affiliate.revokedAt ? affiliate : undefined;
  }

  async findActiveByUserId(userId: string): Promise<AffiliateOutput | undefined> {
    const affiliate = await this.affiliateRepository.findByUserId(userId);
    return affiliate && !affiliate.revokedAt ? affiliate : undefined;
  }

  async #resolveUserId({ userId, email }: { userId?: string; email?: string }): Promise<string> {
    if (userId) return userId;
    if (!email) throw createError(400, "Provide a userId or an email", { errorCode: "affiliate_user_required" });

    const users = await this.userRepository.find({ email });
    if (users.length === 0) throw createError(404, "No user with this email was found", { errorCode: "affiliate_user_not_found" });
    if (users.length > 1) throw createError(409, "Several users share this email; approve by userId instead", { errorCode: "affiliate_email_ambiguous" });

    return users[0].id;
  }

  #requireValidCode(code: string): string {
    const normalized = normalizeAffiliateCode(code);
    if (!normalized) throw createError(400, "Invalid affiliate code", { errorCode: "affiliate_code_invalid" });
    return normalized;
  }

  async #assertCodeAvailable(code: string, excludingAffiliateId?: string): Promise<void> {
    const match = await this.affiliateRepository.findByCode(code);
    if (match && match.id !== excludingAffiliateId) {
      throw createError(409, "This code is already used by another affiliate", { errorCode: "affiliate_code_taken" });
    }
  }

  async #createWithCode({ userId, code, approvedAt, actor }: { userId: string; code?: string; approvedAt: Date; actor: string }): Promise<AffiliateOutput> {
    if (code) {
      return this.affiliateRepository.create({ userId, code, approvedAt, approvedBy: actor });
    }

    for (let attempt = 0; attempt < MAX_GENERATED_CODE_ATTEMPTS; attempt++) {
      const candidate = generateAffiliateCode();
      if (await this.affiliateRepository.findByCode(candidate)) continue;
      return this.affiliateRepository.create({ userId, code: candidate, approvedAt, approvedBy: actor });
    }

    throw createError(500, "Could not generate a unique affiliate code", { errorCode: "affiliate_code_generation_failed" });
  }
}
