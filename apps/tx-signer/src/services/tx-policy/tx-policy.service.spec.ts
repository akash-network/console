import { DepositAuthorization, MsgAccountDeposit, MsgCreateCertificate, MsgMintACT, Scope } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { BasicAllowance, type Coin, MsgGrant, MsgGrantAllowance, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/providers/logging.provider";
import type { AppConfigService } from "@src/services/app-config/app-config.service";
import { TxPolicyService } from "./tx-policy.service";

const SIGNER_ADDRESS = "akash1signer";
const OTHER_ADDRESS = "akash1attacker";
/** Declares a length-delimited field of 127 bytes and then supplies none, so any protobuf decoder runs off the end of the buffer. */
const UNDECODABLE_PAYLOAD = Uint8Array.from([0x0a, 0x7f]);

describe(TxPolicyService.name, () => {
  describe("assertActingOnBehalfOf", () => {
    it("accepts a deployment the signing wallet owns", () => {
      const { service } = setup();
      const message = encodeObject(`/${MsgCreateDeployment.$type}`, MsgCreateDeployment.fromPartial({ id: { owner: SIGNER_ADDRESS, dseq: 1 } }));

      expect(() => service.assertActingOnBehalfOf([message], SIGNER_ADDRESS)).not.toThrow();
    });

    it("rejects a deployment owned by another account", () => {
      const { service } = setup();
      const message = encodeObject(`/${MsgCreateDeployment.$type}`, MsgCreateDeployment.fromPartial({ id: { owner: OTHER_ADDRESS, dseq: 1 } }));

      expect(() => service.assertActingOnBehalfOf([message], SIGNER_ADDRESS)).toThrow(/may not be signed by this wallet/);
    });

    it("rejects a certificate issued for another account", () => {
      const { service } = setup();
      const message = encodeObject(`/${MsgCreateCertificate.$type}`, MsgCreateCertificate.fromPartial({ owner: OTHER_ADDRESS }));

      expect(() => service.assertActingOnBehalfOf([message], SIGNER_ADDRESS)).toThrow(/may not be signed by this wallet/);
    });

    it("rejects a deposit into an escrow account owned by another deployment owner", () => {
      const { service } = setup();
      const message = encodeObject(
        `/${MsgAccountDeposit.$type}`,
        MsgAccountDeposit.fromPartial({ signer: SIGNER_ADDRESS, id: { scope: Scope.deployment, xid: `${OTHER_ADDRESS}/123` } })
      );

      expect(() => service.assertActingOnBehalfOf([message], SIGNER_ADDRESS)).toThrow(/may not be signed by this wallet/);
    });

    it("accepts a deposit into the signing wallet's own escrow account", () => {
      const { service } = setup();
      const message = encodeObject(
        `/${MsgAccountDeposit.$type}`,
        MsgAccountDeposit.fromPartial({ signer: SIGNER_ADDRESS, id: { scope: Scope.deployment, xid: `${SIGNER_ADDRESS}/123` } })
      );

      expect(() => service.assertActingOnBehalfOf([message], SIGNER_ADDRESS)).not.toThrow();
    });

    it("rejects a grant issued by another granter", () => {
      const { service } = setup();
      const message = encodeObject(`/${MsgGrantAllowance.$type}`, MsgGrantAllowance.fromPartial({ granter: OTHER_ADDRESS, grantee: SIGNER_ADDRESS }));

      expect(() => service.assertActingOnBehalfOf([message], SIGNER_ADDRESS)).toThrow(/may not be signed by this wallet/);
    });

    it("rejects a message type it has no binding rule for", () => {
      const { service } = setup();

      expect(() => service.assertActingOnBehalfOf([encodeObject("/cosmos.bank.v1beta1.MsgSend", {})], SIGNER_ADDRESS)).toThrow(
        /may not be signed by this wallet/
      );
    });
  });

  describe("assertWithinGrantLimits", () => {
    it("accepts a fee allowance that declares a spend limit, whatever its amount", () => {
      const { service } = setup();

      expect(() => service.assertWithinGrantLimits([feeAllowance([{ denom: "uakt", amount: "999999999999" }])])).not.toThrow();
    });

    it("rejects a fee allowance that declares no spend limit, which the chain reads as unlimited", () => {
      const { service } = setup();

      expect(() => service.assertWithinGrantLimits([feeAllowance([])])).toThrow(/no spend limit/);
    });

    it("rejects a grant denominated in a denom that is not grantable", () => {
      const { service } = setup();

      expect(() => service.assertWithinGrantLimits([feeAllowance([{ denom: "ibc/ABC", amount: "1" }])])).toThrow(/is not grantable/);
    });

    it("rejects an allowance type other than a basic allowance", () => {
      const { service } = setup();
      const message = encodeObject(
        `/${MsgGrantAllowance.$type}`,
        MsgGrantAllowance.fromPartial({
          granter: SIGNER_ADDRESS,
          allowance: { typeUrl: "/cosmos.feegrant.v1beta1.PeriodicAllowance", value: Uint8Array.from([]) }
        })
      );

      expect(() => service.assertWithinGrantLimits([message])).toThrow(/unsupported allowance type/);
    });

    it("rejects a fee allowance whose payload cannot be decoded", () => {
      const { service } = setup();
      const message = encodeObject(
        `/${MsgGrantAllowance.$type}`,
        MsgGrantAllowance.fromPartial({
          granter: SIGNER_ADDRESS,
          allowance: { typeUrl: `/${BasicAllowance.$type}`, value: UNDECODABLE_PAYLOAD }
        })
      );

      expect(() => service.assertWithinGrantLimits([message])).toThrow(/cannot be decoded/);
    });

    it("accepts a deposit authorization that declares a spend limit", () => {
      const { service } = setup();

      expect(() => service.assertWithinGrantLimits([depositAuthorization([{ denom: "uact", amount: "20000000" }])])).not.toThrow();
    });

    it("rejects a deposit authorization that declares no spend limit", () => {
      const { service } = setup();

      expect(() => service.assertWithinGrantLimits([depositAuthorization([])])).toThrow(/no spend limit/);
    });

    it("rejects an authorization type other than a deposit authorization", () => {
      const { service } = setup();
      const message = encodeObject(
        `/${MsgGrant.$type}`,
        MsgGrant.fromPartial({
          granter: SIGNER_ADDRESS,
          grant: { authorization: { typeUrl: "/cosmos.bank.v1beta1.SendAuthorization", value: Uint8Array.from([]) } }
        })
      );

      expect(() => service.assertWithinGrantLimits([message])).toThrow(/unsupported authorization type/);
    });

    it("rejects a deposit authorization whose payload cannot be decoded", () => {
      const { service } = setup();
      const message = encodeObject(
        `/${MsgGrant.$type}`,
        MsgGrant.fromPartial({
          granter: SIGNER_ADDRESS,
          grant: { authorization: { typeUrl: `/${DepositAuthorization.$type}`, value: UNDECODABLE_PAYLOAD } }
        })
      );

      expect(() => service.assertWithinGrantLimits([message])).toThrow(/cannot be decoded/);
    });

    it("ignores a revoke, which gives nothing away", () => {
      const { service } = setup();
      const message = encodeObject(`/${MsgRevokeAllowance.$type}`, MsgRevokeAllowance.fromPartial({ granter: SIGNER_ADDRESS }));

      expect(() => service.assertWithinGrantLimits([message])).not.toThrow();
    });
  });

  describe("assertWithinGrantLimits for mints", () => {
    it("accepts any burn, since a mint only swaps the signing wallet's own AKT for its own ACT", () => {
      const { service } = setup();
      const message = encodeObject(`/${MsgMintACT.$type}`, MsgMintACT.fromPartial({ coinsToBurn: { denom: "uakt", amount: "999999999999" } }));

      expect(() => service.assertWithinGrantLimits([message])).not.toThrow();
    });
  });

  describe("assertFeeGranter", () => {
    it("rejects a fee granter that is not the funding wallet", () => {
      const { service } = setup();

      expect(() => service.assertFeeGranter(OTHER_ADDRESS, SIGNER_ADDRESS)).toThrow(/only be granted by the funding wallet/);
    });

    it("accepts an absent fee granter", () => {
      const { service } = setup();

      expect(() => service.assertFeeGranter(undefined, SIGNER_ADDRESS)).not.toThrow();
    });
  });

  function encodeObject(typeUrl: string, value: object): EncodeObject {
    return { typeUrl, value };
  }

  function feeAllowance(spendLimit: Coin[]): EncodeObject {
    return encodeObject(
      `/${MsgGrantAllowance.$type}`,
      MsgGrantAllowance.fromPartial({
        granter: SIGNER_ADDRESS,
        grantee: OTHER_ADDRESS,
        allowance: {
          typeUrl: `/${BasicAllowance.$type}`,
          value: Uint8Array.from(BasicAllowance.encode(BasicAllowance.fromPartial({ spendLimit })).finish())
        }
      })
    );
  }

  function depositAuthorization(spendLimits: Coin[]): EncodeObject {
    return encodeObject(
      `/${MsgGrant.$type}`,
      MsgGrant.fromPartial({
        granter: SIGNER_ADDRESS,
        grantee: OTHER_ADDRESS,
        grant: {
          authorization: {
            typeUrl: `/${DepositAuthorization.$type}`,
            value: Uint8Array.from(DepositAuthorization.encode(DepositAuthorization.fromPartial({ spendLimits })).finish())
          }
        }
      })
    );
  }

  function setup(input: { allowedDenoms?: string[] } = {}) {
    const config = mock<AppConfigService>({
      get: (() => input.allowedDenoms ?? ["uakt", "uact"]) as AppConfigService["get"]
    });
    const service = new TxPolicyService(mock<LoggerService>(), config);

    return { service, config };
  }
});
