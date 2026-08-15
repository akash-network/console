import { describe, expect, it } from "vitest";

import { AKASH_ADDRESS_PREFIX } from "@src/genesis/genesis-address";
import { BME_VAULT_ADDRESS, buildModuleAddressRegistry, deriveModuleAddress } from "@src/pipeline/balance/module-address-registry";
import type { ReasonContext } from "@src/pipeline/balance/reason-classifier";
import { classifyReason } from "@src/pipeline/balance/reason-classifier";

const registry = buildModuleAddressRegistry(AKASH_ADDRESS_PREFIX);
const moduleAddress = (name: string) => deriveModuleAddress(name, AKASH_ADDRESS_PREFIX);
const WITHDRAW_DELEGATOR_REWARD = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward";
const WITHDRAW_VALIDATOR_COMMISSION = "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission";

describe("classifyReason", () => {
  it("classifies a payment to the fee collector as a fee", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("fee_collector") }), registry)).toBe("fee");
  });

  it("classifies a credit from the distribution module as a reward", () => {
    expect(
      classifyReason(context({ counterpartyAddress: moduleAddress("distribution"), isCredit: true, msgTypeUrl: WITHDRAW_DELEGATOR_REWARD }), registry)
    ).toBe("reward");
  });

  it("classifies a credit from distribution withdrawn by a validator commission message as commission", () => {
    const ctx = context({ counterpartyAddress: moduleAddress("distribution"), isCredit: true, msgTypeUrl: WITHDRAW_VALIDATOR_COMMISSION });
    expect(classifyReason(ctx, registry)).toBe("commission");
  });

  it("classifies a debit to the distribution module (fund community pool) as a plain transfer, not a reward", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("distribution"), isCredit: false }), registry)).toBe("transfer");
  });

  it("classifies a flow with the bonded pool as staking", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("bonded_tokens_pool") }), registry)).toBe("staking");
  });

  it("classifies a flow with the not-bonded pool as staking", () => {
    expect(classifyReason(context({ address: moduleAddress("not_bonded_tokens_pool") }), registry)).toBe("staking");
  });

  it("classifies a gov flow as gov", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("gov") }), registry)).toBe("gov");
  });

  it("classifies an ibc transfer module flow as ibc", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("transfer") }), registry)).toBe("ibc");
  });

  it("classifies a flow of an ibc denom as ibc", () => {
    expect(classifyReason(context({ denom: "ibc/ABCDEF", counterpartyAddress: "akash1peer" }), registry)).toBe("ibc");
  });

  it("classifies a deposit whose counterparty is the escrow module as escrow", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("escrow") }), registry)).toBe("escrow");
  });

  it("classifies a settlement paid out by the escrow module as escrow", () => {
    expect(classifyReason(context({ address: moduleAddress("escrow"), counterpartyAddress: "akash1provider" }), registry)).toBe("escrow");
  });

  it("classifies a flow with the BME vault as bme", () => {
    expect(classifyReason(context({ counterpartyAddress: BME_VAULT_ADDRESS }), registry)).toBe("bme");
  });

  it("prefers slash over any module role", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("bonded_tokens_pool"), isSlash: true }), registry)).toBe("slash");
  });

  it("classifies a coinbase-coincident credit as mint", () => {
    expect(classifyReason(context({ isMint: true }), registry)).toBe("mint");
  });

  it("classifies a flow whose counterparty is the mint module as mint", () => {
    expect(classifyReason(context({ counterpartyAddress: moduleAddress("mint") }), registry)).toBe("mint");
  });

  it("classifies a burn-coincident debit as burn", () => {
    expect(classifyReason(context({ isBurn: true }), registry)).toBe("burn");
  });

  it("defaults a plain account-to-account movement to transfer", () => {
    expect(classifyReason(context({ counterpartyAddress: "akash1peer" }), registry)).toBe("transfer");
  });

  it("tags the fee_collector's own leg by its role rather than the distribution counterparty", () => {
    expect(classifyReason(context({ address: moduleAddress("fee_collector"), counterpartyAddress: moduleAddress("distribution") }), registry)).toBe("fee");
  });

  it("tags both legs of a reward withdrawal as reward, including the distribution module's own debit leg", () => {
    const distribution = moduleAddress("distribution");

    expect(
      classifyReason(
        context({ address: "akash1delegator", counterpartyAddress: distribution, isCredit: true, msgTypeUrl: WITHDRAW_DELEGATOR_REWARD }),
        registry
      )
    ).toBe("reward");
    expect(
      classifyReason(
        context({ address: distribution, counterpartyAddress: "akash1delegator", isCredit: false, msgTypeUrl: WITHDRAW_DELEGATOR_REWARD }),
        registry
      )
    ).toBe("reward");
  });

  it("tags both legs of a commission withdrawal as commission", () => {
    const distribution = moduleAddress("distribution");

    expect(
      classifyReason(
        context({ address: "akash1validator", counterpartyAddress: distribution, isCredit: true, msgTypeUrl: WITHDRAW_VALIDATOR_COMMISSION }),
        registry
      )
    ).toBe("commission");
    expect(
      classifyReason(
        context({ address: distribution, counterpartyAddress: "akash1validator", isCredit: false, msgTypeUrl: WITHDRAW_VALIDATOR_COMMISSION }),
        registry
      )
    ).toBe("commission");
  });

  it("classifies both legs of a community-pool spend as a transfer, not a reward", () => {
    const distribution = moduleAddress("distribution");

    expect(classifyReason(context({ address: "akash1recipient", counterpartyAddress: distribution, isCredit: true, msgTypeUrl: null }), registry)).toBe(
      "transfer"
    );
    expect(classifyReason(context({ address: distribution, counterpartyAddress: "akash1recipient", isCredit: false, msgTypeUrl: null }), registry)).toBe(
      "transfer"
    );
  });

  it("does not mistake the distribution module's own funding inflow for a reward", () => {
    expect(
      classifyReason(context({ address: moduleAddress("distribution"), counterpartyAddress: moduleAddress("fee_collector"), isCredit: true }), registry)
    ).toBe("transfer");
  });

  it("tags the mint module's outgoing forwarding leg as mint rather than the counterparty's fee", () => {
    expect(classifyReason(context({ address: moduleAddress("mint"), counterpartyAddress: moduleAddress("fee_collector") }), registry)).toBe("mint");
  });

  function context(overrides: Partial<ReasonContext>): ReasonContext {
    return {
      address: "akash1self",
      counterpartyAddress: null,
      denom: "uakt",
      isMint: false,
      isBurn: false,
      isSlash: false,
      isCredit: false,
      msgTypeUrl: null,
      ...overrides
    };
  }
});
