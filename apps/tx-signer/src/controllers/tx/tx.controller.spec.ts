import { MsgGrantAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { Registry } from "@cosmjs/proto-signing";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TxManagerService } from "@src/services/tx-manager/tx-manager.service";
import type { TxPolicyService } from "@src/services/tx-policy/tx-policy.service";
import { TxController } from "./tx.controller";

describe(TxController.name, () => {
  it("decodes messages and signs with funding wallet", async () => {
    const { controller, registry, txManagerService, decodedMessage } = setup();

    const result = await controller.signWithFundingWallet({
      data: { messages: [encodedMessage()] }
    });

    expect(registry.decode).toHaveBeenCalledWith({ typeUrl: decodedMessage.typeUrl, value: expect.any(Uint8Array) });
    expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith([decodedMessage]);
    expect(result.data.code).toBe(0);
  });

  it("checks funding messages against the funding wallet before signing", async () => {
    const { controller, txPolicyService, decodedMessage, fundingWalletAddress } = setup();

    await controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } });

    expect(txPolicyService.assertActingOnBehalfOf).toHaveBeenCalledWith([decodedMessage], fundingWalletAddress);
    expect(txPolicyService.assertWithinGrantLimits).toHaveBeenCalledWith([decodedMessage]);
  });

  it("checks derived messages against the derived wallet and its fee granter", async () => {
    const { controller, txPolicyService, decodedMessage, derivedWalletAddress, fundingWalletAddress } = setup();

    await controller.signWithDerivedWallet({
      data: { derivationIndex: 3, messages: [encodedMessage()], options: { fee: { granter: fundingWalletAddress } } }
    });

    expect(txPolicyService.assertActingOnBehalfOf).toHaveBeenCalledWith([decodedMessage], derivedWalletAddress);
    expect(txPolicyService.assertFeeGranter).toHaveBeenCalledWith(fundingWalletAddress, fundingWalletAddress);
  });

  it("does not broadcast when the policy rejects the messages", async () => {
    const { controller, txManagerService, txPolicyService } = setup();
    txPolicyService.assertActingOnBehalfOf.mockImplementation(() => {
      throw new Error("rejected");
    });

    await expect(controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } })).rejects.toThrow("rejected");
    expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
  });

  function encodedMessage() {
    return { typeUrl: `/${MsgGrantAllowance.$type}`, value: Buffer.from([1, 2, 3]).toString("base64") } as const;
  }

  function setup() {
    const decodedMessage = { typeUrl: `/${MsgGrantAllowance.$type}`, value: { foo: "bar" } };
    const fundingWalletAddress = "akash1funding";
    const derivedWalletAddress = "akash1derived";
    const registry = mock<Registry>({
      decode: vi.fn().mockReturnValue(decodedMessage.value)
    });
    const txManagerService = mock<TxManagerService>({
      getFundingWalletAddress: vi.fn().mockResolvedValue(fundingWalletAddress),
      getDerivedWalletAddress: vi.fn().mockResolvedValue(derivedWalletAddress),
      signAndBroadcastWithFundingWallet: vi.fn().mockResolvedValue({ code: 0, hash: "tx", rawLog: "" }),
      signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({ code: 0, hash: "tx", rawLog: "" })
    });
    const txPolicyService = mock<TxPolicyService>();

    return {
      controller: new TxController(registry, txManagerService, txPolicyService),
      registry,
      txManagerService,
      txPolicyService,
      decodedMessage,
      fundingWalletAddress,
      derivedWalletAddress
    };
  }
});
