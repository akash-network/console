import { singleton } from "tsyringe";

import type {
  ApproveAffiliateRequest,
  ApproveAffiliateResponse,
  RevokeAffiliateRequest,
  RevokeAffiliateResponse
} from "@src/affiliate/http-schemas/affiliate-admin.schema";
import type { AffiliateProfileResponse } from "@src/affiliate/http-schemas/affiliate-profile.schema";
import { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { AuthService, Protected } from "@src/auth/services/auth.service";

@singleton()
export class AffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly authService: AuthService
  ) {}

  async approve(input: ApproveAffiliateRequest["data"]): Promise<ApproveAffiliateResponse> {
    const affiliate = await this.affiliateService.approve(input);
    return { data: { id: affiliate.id, userId: affiliate.userId, code: affiliate.code, approvedAt: affiliate.approvedAt } };
  }

  async revoke(code: string, { actor }: RevokeAffiliateRequest["data"]): Promise<RevokeAffiliateResponse> {
    const affiliate = await this.affiliateService.revoke({ code, actor });
    return { data: { id: affiliate.id, code: affiliate.code, revokedAt: affiliate.revokedAt! } };
  }

  @Protected([{ action: "read", subject: "Affiliate" }])
  async getProfile(): Promise<AffiliateProfileResponse> {
    const profile = await this.affiliateService.getProfile(this.authService.currentUser.id);
    return { data: profile };
  }
}
