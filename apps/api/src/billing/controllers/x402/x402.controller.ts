import type { HTTPRequestContext } from "@x402/core/server";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import type { X402DeployInput, X402DeployProcessResult, X402TopUpProcessResult } from "@src/billing/services/x402/x402.service";
import { X402Service } from "@src/billing/services/x402/x402.service";

@singleton()
export class X402Controller {
  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly x402Service: X402Service,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "create", subject: "X402Payment" }])
  async topUp(context: HTTPRequestContext, amountUsd: number): Promise<X402TopUpProcessResult> {
    assert(this.x402Service.isEnabled, 404, "x402 payments are not enabled");
    assert(
      amountUsd >= this.config.X402_MIN_TOP_UP_USD && amountUsd <= this.config.X402_MAX_TOP_UP_USD,
      400,
      `Top-up amount must be between ${this.config.X402_MIN_TOP_UP_USD} and ${this.config.X402_MAX_TOP_UP_USD} USD`
    );

    const { currentUser } = this.authService;

    return await this.x402Service.processTopUp(context, currentUser.id, amountUsd);
  }

  // Requires `sign UserWallet` — the same ability normal deployment creation enforces
  // (DeploymentController.create) — so the x402-paid path cannot bypass wallet-signing authorization,
  // plus `create X402Payment` for the payment itself. Applies identically to bearer and api-key auth.
  @Protected([
    { action: "sign", subject: "UserWallet" },
    { action: "create", subject: "X402Payment" }
  ])
  async deploy(context: HTTPRequestContext, input: X402DeployInput): Promise<X402DeployProcessResult> {
    assert(this.x402Service.isEnabled, 404, "x402 payments are not enabled");
    assert(
      input.deposit >= this.config.X402_MIN_DEPLOY_USD && input.deposit <= this.config.X402_MAX_DEPLOY_USD,
      400,
      `Deploy deposit must be between ${this.config.X402_MIN_DEPLOY_USD} and ${this.config.X402_MAX_DEPLOY_USD} USD`
    );

    const { currentUser } = this.authService;

    return await this.x402Service.processDeploy(context, currentUser.id, input);
  }
}
