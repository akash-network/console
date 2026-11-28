import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgGrantAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { Registry } from "@cosmjs/proto-signing";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundingFreezeService } from "@src/services/funding-freeze/funding-freeze.service";
import type { FundingOutflowService } from "@src/services/funding-outflow/funding-outflow.service";
import type { TxManagerService } from "@src/services/tx-manager/tx-manager.service";
import type { TxPolicyService } from "@src/services/tx-policy/tx-policy.service";
import { TxController } from "./tx.controller";

describe(TxController.name, () => {
  it("decodes messages and signs with funding wallet", async () => {
    const { controller, registry, txManagerService, decodedMessage, fundingWalletAddress } = setup();

    const result = await controller.signWithFundingWallet({
      data: { messages: [encodedMessage()] }
    });

    expect(registry.decode).toHaveBeenCalledWith({ typeUrl: decodedMessage.typeUrl, value: expect.any(Uint8Array) });
    expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(fundingWalletAddress, [decodedMessage]);
    expect(result.data.code).toBe(0);
  });

  it("signs with whichever funding wallet the messages name", async () => {
    const { controller, txManagerService, txPolicyService, decodedMessage, fundingWalletAddresses, secondFundingWalletAddress } = setup();
    txPolicyService.resolveFundingSigner.mockReturnValue(secondFundingWalletAddress);

    await controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } });

    expect(txPolicyService.resolveFundingSigner).toHaveBeenCalledWith([decodedMessage], fundingWalletAddresses);
    expect(txPolicyService.assertActingOnBehalfOf).toHaveBeenCalledWith([decodedMessage], secondFundingWalletAddress);
    expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith(secondFundingWalletAddress, [decodedMessage]);
  });

  it("does not broadcast messages that name no funding wallet", async () => {
    const { controller, txManagerService, txPolicyService } = setup();
    txPolicyService.resolveFundingSigner.mockImplementation(() => {
      throw new Error("not a funding wallet");
    });

    await expect(controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } })).rejects.toThrow("not a funding wallet");
    expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
  });

  it("checks funding messages against the funding wallet before signing", async () => {
    const { controller, txPolicyService, decodedMessage, fundingWalletAddress } = setup();

    await controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } });

    expect(txPolicyService.assertActingOnBehalfOf).toHaveBeenCalledWith([decodedMessage], fundingWalletAddress);
    expect(txPolicyService.assertWithinGrantLimits).toHaveBeenCalledWith([decodedMessage]);
  });

  it("checks funding grants against the managed wallet at the named derivation index", async () => {
    const { controller, txManagerService, txPolicyService, decodedMessage, derivedWalletAddress } = setup();

    await controller.signWithFundingWallet({ data: { messages: [encodedMessage()], granteeDerivationIndex: 5 } });

    expect(txManagerService.getDerivedWalletAddress).toHaveBeenCalledWith(5, undefined);
    expect(txPolicyService.assertGrantedToManagedWallet).toHaveBeenCalledWith([decodedMessage], derivedWalletAddress);
  });

  it("checks funding grants against the managed wallet of the seed version named for the grantee", async () => {
    const { controller, txManagerService } = setup();

    await controller.signWithFundingWallet({ data: { messages: [encodedMessage()], granteeDerivationIndex: 5, granteeSeedVersion: "v3" } });

    expect(txManagerService.getDerivedWalletAddress).toHaveBeenCalledWith(5, "v3");
  });

  it("binds a derived tx to, and signs it with, the wallet of the seed version it names", async () => {
    const { controller, txManagerService, txPolicyService, derivedWalletAddress } = setup();

    await controller.signWithDerivedWallet({ data: { derivationIndex: 3, seedVersion: "v3", messages: [encodedDerivedMessage()] } });

    expect(txManagerService.getDerivedWalletAddress).toHaveBeenCalledWith(3, "v3");
    expect(txPolicyService.assertActingOnBehalfOf).toHaveBeenCalledWith(expect.any(Array), derivedWalletAddress);
    expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledWith(3, expect.any(Array), undefined, "v3");
  });

  it("checks funding grants against no managed wallet when none is named", async () => {
    const { controller, txManagerService, txPolicyService, decodedMessage } = setup();

    await controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } });

    expect(txManagerService.getDerivedWalletAddress).not.toHaveBeenCalled();
    expect(txPolicyService.assertGrantedToManagedWallet).toHaveBeenCalledWith([decodedMessage], undefined);
  });

  it("does not broadcast a funding grant the policy refuses for its grantee", async () => {
    const { controller, txManagerService, txPolicyService } = setup();
    txPolicyService.assertGrantedToManagedWallet.mockImplementation(() => {
      throw new Error("rejected grantee");
    });

    await expect(controller.signWithFundingWallet({ data: { messages: [encodedMessage()], granteeDerivationIndex: 5 } })).rejects.toThrow("rejected grantee");
    expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
  });

  it("checks that funding sends stay between the funding wallets before signing", async () => {
    const { controller, txPolicyService, decodedMessage, fundingWalletAddresses } = setup();

    await controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } });

    expect(txPolicyService.assertSentToAnotherFundingWallet).toHaveBeenCalledWith([decodedMessage], fundingWalletAddresses);
  });

  it("does not broadcast a funding send the policy refuses for its recipient", async () => {
    const { controller, txManagerService, txPolicyService } = setup();
    txPolicyService.assertSentToAnotherFundingWallet.mockImplementation(() => {
      throw new Error("rejected recipient");
    });

    await expect(controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } })).rejects.toThrow("rejected recipient");
    expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
  });

  it("signs a derived tx that names no fee options", async () => {
    const { controller, txManagerService, txPolicyService, fundingWalletAddresses } = setup();

    await controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } });

    expect(txPolicyService.assertFeeGranter).toHaveBeenCalledWith(undefined, fundingWalletAddresses);
    expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledWith(3, expect.any(Array), undefined, undefined);
  });

  it("checks derived messages against the derived wallet and its fee granter", async () => {
    const { controller, txPolicyService, decodedMessage, derivedWalletAddress, fundingWalletAddress, fundingWalletAddresses } = setup();
    const message = encodedDerivedMessage();

    await controller.signWithDerivedWallet({
      data: { derivationIndex: 3, messages: [message], options: { fee: { granter: fundingWalletAddress } } }
    });

    expect(txPolicyService.assertActingOnBehalfOf).toHaveBeenCalledWith([{ typeUrl: message.typeUrl, value: decodedMessage.value }], derivedWalletAddress);
    expect(txPolicyService.assertFeeGranter).toHaveBeenCalledWith(fundingWalletAddress, fundingWalletAddresses);
  });

  it("does not broadcast when the policy rejects the messages", async () => {
    const { controller, txManagerService, txPolicyService } = setup();
    txPolicyService.assertActingOnBehalfOf.mockImplementation(() => {
      throw new Error("rejected");
    });

    await expect(controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } })).rejects.toThrow("rejected");
    expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
  });

  describe("when funding may be frozen", () => {
    it("asks whether funding is frozen before signing with a funding wallet, once the policy let the request through", async () => {
      const { controller, txManagerService, txPolicyService, fundingFreezeService } = setup();

      await controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } });

      const askedAt = fundingFreezeService.assertFundingIsNotFrozen.mock.invocationCallOrder[0];
      expect(txPolicyService.assertSentToAnotherFundingWallet.mock.invocationCallOrder[0]).toBeLessThan(askedAt);
      expect(askedAt).toBeLessThan(txManagerService.signAndBroadcastWithFundingWallet.mock.invocationCallOrder[0]);
    });

    it("signs nothing with a funding wallet while funding is frozen", async () => {
      const { controller, txManagerService, fundingFreezeService } = setup();
      fundingFreezeService.assertFundingIsNotFrozen.mockRejectedValue(new Error("Funding is frozen"));

      await expect(controller.signWithFundingWallet({ data: { messages: [encodedMessage()] } })).rejects.toThrow("Funding is frozen");
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("signs no deposit a user wallet draws from a grant while funding is frozen", async () => {
      const { controller, txManagerService, fundingFreezeService, registry } = setup();
      registry.decode.mockReturnValue(deploymentDepositing([Source.grant]));
      fundingFreezeService.assertFundingIsNotFrozen.mockRejectedValue(new Error("Funding is frozen"));

      await expect(controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } })).rejects.toThrow(
        "Funding is frozen"
      );
      expect(txManagerService.signAndBroadcastWithDerivedWallet).not.toHaveBeenCalled();
    });

    it("signs a deposit a user wallet draws from a grant while funding is open, having asked first", async () => {
      const { controller, txManagerService, fundingFreezeService, registry } = setup();
      registry.decode.mockReturnValue(deploymentDepositing([Source.grant]));

      await controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } });

      expect(fundingFreezeService.assertFundingIsNotFrozen.mock.invocationCallOrder[0]).toBeLessThan(
        txManagerService.signAndBroadcastWithDerivedWallet.mock.invocationCallOrder[0]
      );
    });

    it("signs what a user wallet does without a funding wallet's coins without asking, so a freeze leaves it working", async () => {
      const { controller, txManagerService, fundingFreezeService, registry } = setup();
      fundingFreezeService.assertFundingIsNotFrozen.mockRejectedValue(new Error("Funding is frozen"));

      await controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } });
      registry.decode.mockReturnValue(deploymentDepositing([Source.balance]));
      await controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } });

      expect(fundingFreezeService.assertFundingIsNotFrozen).not.toHaveBeenCalled();
      expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledTimes(2);
    });
  });

  describe("when what leaves the funding wallets is counted", () => {
    it("has a user wallet's grant-funded deposits counted against the wallet it signs for, around the signing", async () => {
      const { controller, txManagerService, fundingOutflowService, registry, derivedWalletAddress } = setup();
      registry.decode.mockReturnValue(deploymentDepositing([Source.grant]));

      const result = await controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } });

      expect(fundingOutflowService.track).toHaveBeenCalledExactlyOnceWith(derivedWalletAddress, [{ denom: "uact", amount: "5000000" }], expect.any(Function));
      expect(txManagerService.signAndBroadcastWithDerivedWallet).toHaveBeenCalledExactlyOnceWith(3, expect.any(Array), undefined, undefined);
      expect(result).toEqual({ data: { code: 0, hash: "tx", rawLog: "" } });
    });

    it("has nothing counted for a tx that takes none of a funding wallet's coins", async () => {
      const { controller, fundingOutflowService, derivedWalletAddress } = setup();

      await controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } });

      expect(fundingOutflowService.track).toHaveBeenCalledExactlyOnceWith(derivedWalletAddress, [], expect.any(Function));
    });

    it("signs nothing when the count refuses the deposit", async () => {
      const { controller, txManagerService, fundingOutflowService, registry } = setup();
      registry.decode.mockReturnValue(deploymentDepositing([Source.grant]));
      fundingOutflowService.track.mockRejectedValue(new Error("past the limit"));

      await expect(controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } })).rejects.toThrow("past the limit");
      expect(txManagerService.signAndBroadcastWithDerivedWallet).not.toHaveBeenCalled();
    });

    it("asks whether funding is frozen before anything is counted", async () => {
      const { controller, fundingFreezeService, fundingOutflowService, registry } = setup();
      registry.decode.mockReturnValue(deploymentDepositing([Source.grant]));
      fundingFreezeService.assertFundingIsNotFrozen.mockRejectedValue(new Error("Funding is frozen"));

      await expect(controller.signWithDerivedWallet({ data: { derivationIndex: 3, messages: [encodedDerivedMessage()] } })).rejects.toThrow(
        "Funding is frozen"
      );
      expect(fundingOutflowService.track).not.toHaveBeenCalled();
    });
  });

  function deploymentDepositing(sources: Source[]) {
    return MsgCreateDeployment.fromPartial({ deposit: { amount: { denom: "uact", amount: "5000000" }, sources } });
  }

  function encodedMessage() {
    return { typeUrl: `/${MsgGrantAllowance.$type}`, value: Buffer.from([1, 2, 3]).toString("base64") } as const;
  }

  function encodedDerivedMessage() {
    return { typeUrl: `/${MsgCreateDeployment.$type}`, value: Buffer.from([1, 2, 3]).toString("base64") } as const;
  }

  function setup() {
    const decodedMessage = { typeUrl: `/${MsgGrantAllowance.$type}`, value: { foo: "bar" } };
    const fundingWalletAddress = "akash1funding";
    const secondFundingWalletAddress = "akash1secondfunding";
    const fundingWalletAddresses = [fundingWalletAddress, secondFundingWalletAddress];
    const derivedWalletAddress = "akash1derived";
    const registry = mock<Registry>({
      decode: vi.fn().mockReturnValue(decodedMessage.value)
    });
    const txManagerService = mock<TxManagerService>({
      getFundingWalletAddresses: vi.fn().mockResolvedValue(fundingWalletAddresses),
      getDerivedWalletAddress: vi.fn().mockResolvedValue(derivedWalletAddress),
      signAndBroadcastWithFundingWallet: vi.fn().mockResolvedValue({ code: 0, hash: "tx", rawLog: "" }),
      signAndBroadcastWithDerivedWallet: vi.fn().mockResolvedValue({ code: 0, hash: "tx", rawLog: "" })
    });
    const txPolicyService = mock<TxPolicyService>();
    txPolicyService.resolveFundingSigner.mockReturnValue(fundingWalletAddress);
    const fundingFreezeService = mock<FundingFreezeService>();
    const fundingOutflowService = mock<FundingOutflowService>();
    fundingOutflowService.track.mockImplementation(async (_walletAddress, _deposits, signAndBroadcast) => await signAndBroadcast());

    return {
      controller: new TxController(registry, txManagerService, txPolicyService, fundingFreezeService, fundingOutflowService),
      fundingOutflowService,
      registry,
      txManagerService,
      txPolicyService,
      fundingFreezeService,
      decodedMessage,
      fundingWalletAddress,
      secondFundingWalletAddress,
      fundingWalletAddresses,
      derivedWalletAddress
    };
  }
});
