import { toBase64 } from "@cosmjs/encoding";
import { QueryValidatorDelegationsResponse, QueryValidatorsResponse, QueryValidatorUnbondingDelegationsResponse } from "cosmjs-types/cosmos/staking/v1beta1/query";
import { BondStatus } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import { describe, expect, it } from "vitest";

import {
  decodeValidatorDelegations,
  decodeValidators,
  decodeValidatorUnbonding,
  encodeValidatorDelegationsRequest,
  encodeValidatorsRequest,
  formatDec,
  VALIDATOR_DELEGATIONS_PATH,
  VALIDATORS_PATH
} from "@src/staking/staking-query";

describe("staking-query", () => {
  describe("formatDec", () => {
    it("renders a whole-share LegacyDec as a fixed 18-decimal string", () => {
      expect(formatDec("5000000000000000000000000")).toBe("5000000.000000000000000000");
    });

    it("renders a sub-one commission rate", () => {
      expect(formatDec("100000000000000000")).toBe("0.100000000000000000");
    });

    it("renders zero and negative values", () => {
      expect(formatDec("0")).toBe("0.000000000000000000");
      expect(formatDec("-2500000000000000000")).toBe("-2.500000000000000000");
    });
  });

  describe("encode", () => {
    it("encodes a validators request as hex", () => {
      expect(encodeValidatorsRequest()).toMatch(/^[0-9a-f]*$/);
      expect(VALIDATORS_PATH).toBe("/cosmos.staking.v1beta1.Query/Validators");
    });

    it("encodes a validator-delegations request carrying the operator address", () => {
      const hex = encodeValidatorDelegationsRequest("akashvaloper1abc");

      expect(Buffer.from(hex, "hex").toString("utf8")).toContain("akashvaloper1abc");
      expect(VALIDATOR_DELEGATIONS_PATH).toBe("/cosmos.staking.v1beta1.Query/ValidatorDelegations");
    });
  });

  describe("decodeValidators", () => {
    it("maps a bonded validator's dynamic state and scales its shares", () => {
      const value = toBase64(
        QueryValidatorsResponse.encode(
          QueryValidatorsResponse.fromPartial({
            validators: [
              {
                operatorAddress: "akashvaloper1abc",
                jailed: false,
                status: BondStatus.BOND_STATUS_BONDED,
                tokens: "7000000",
                delegatorShares: "7000000000000000000000000"
              }
            ]
          })
        ).finish()
      );

      expect(decodeValidators(value).items).toEqual([
        {
          operatorAddress: "akashvaloper1abc",
          hexAddress: null,
          accountAddress: null,
          moniker: null,
          identity: null,
          website: null,
          details: null,
          securityContact: null,
          commissionRate: null,
          commissionMaxRate: null,
          commissionMaxChangeRate: null,
          minSelfDelegation: null,
          jailed: false,
          status: "bonded",
          tokens: "7000000",
          delegatorShares: "7000000.000000000000000000",
          unbondingHeight: null,
          unbondingTime: null
        }
      ]);
    });

    it("maps a validator's description and commission, scaling the rates", () => {
      const value = toBase64(
        QueryValidatorsResponse.encode(
          QueryValidatorsResponse.fromPartial({
            validators: [
              {
                operatorAddress: "akashvaloper1abc",
                status: BondStatus.BOND_STATUS_BONDED,
                tokens: "1",
                delegatorShares: "1000000000000000000",
                description: { moniker: "Node A", identity: "ABC", website: "https://a", details: "d", securityContact: "s@a" },
                commission: { commissionRates: { rate: "50000000000000000", maxRate: "200000000000000000", maxChangeRate: "10000000000000000" } },
                minSelfDelegation: "1"
              }
            ]
          })
        ).finish()
      );

      expect(decodeValidators(value).items[0]).toMatchObject({
        moniker: "Node A",
        identity: "ABC",
        website: "https://a",
        details: "d",
        securityContact: "s@a",
        commissionRate: "0.050000000000000000",
        commissionMaxRate: "0.200000000000000000",
        commissionMaxChangeRate: "0.010000000000000000",
        minSelfDelegation: "1"
      });
    });

    it("keeps the unbonding height and time for an unbonding validator", () => {
      const value = toBase64(
        QueryValidatorsResponse.encode(
          QueryValidatorsResponse.fromPartial({
            validators: [
              {
                operatorAddress: "akashvaloper1unbonding",
                jailed: true,
                status: BondStatus.BOND_STATUS_UNBONDING,
                tokens: "0",
                delegatorShares: "0",
                unbondingHeight: 4321n,
                unbondingTime: { seconds: 1_700_000_000n, nanos: 0 }
              }
            ]
          })
        ).finish()
      );

      const [validator] = decodeValidators(value).items;

      expect(validator.status).toBe("unbonding");
      expect(validator.jailed).toBe(true);
      expect(validator.unbondingHeight).toBe(4321);
      expect(validator.unbondingTime).toEqual(new Date(1_700_000_000_000));
    });

    it("surfaces the pagination cursor when the page is full", () => {
      const value = toBase64(
        QueryValidatorsResponse.encode(
          QueryValidatorsResponse.fromPartial({ validators: [], pagination: { nextKey: new Uint8Array([1, 2, 3]), total: 0n } })
        ).finish()
      );

      expect(decodeValidators(value).nextKey).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("returns an empty page for an absent value", () => {
      expect(decodeValidators(null)).toEqual({ items: [], nextKey: null });
    });
  });

  describe("decodeValidatorDelegations", () => {
    it("maps delegations under the queried validator and scales shares", () => {
      const value = toBase64(
        QueryValidatorDelegationsResponse.encode(
          QueryValidatorDelegationsResponse.fromPartial({
            delegationResponses: [
              { delegation: { delegatorAddress: "akash1del", validatorAddress: "akashvaloper1abc", shares: "3000000000000000000000000" }, balance: { denom: "uakt", amount: "3000000" } }
            ]
          })
        ).finish()
      );

      expect(decodeValidatorDelegations("akashvaloper1abc", value).items).toEqual([
        { delegatorAddress: "akash1del", validatorOperatorAddress: "akashvaloper1abc", shares: "3000000.000000000000000000" }
      ]);
    });
  });

  describe("decodeValidatorUnbonding", () => {
    it("flattens unbonding entries under the delegator and queried validator", () => {
      const value = toBase64(
        QueryValidatorUnbondingDelegationsResponse.encode(
          QueryValidatorUnbondingDelegationsResponse.fromPartial({
            unbondingResponses: [
              {
                delegatorAddress: "akash1del",
                validatorAddress: "akashvaloper1abc",
                entries: [{ creationHeight: 100n, completionTime: { seconds: 1_700_000_500n, nanos: 0 }, initialBalance: "500000", balance: "500000" }]
              }
            ]
          })
        ).finish()
      );

      expect(decodeValidatorUnbonding("akashvaloper1abc", value).items).toEqual([
        {
          delegatorAddress: "akash1del",
          validatorOperatorAddress: "akashvaloper1abc",
          creationHeight: 100,
          completionTime: new Date(1_700_000_500_000),
          initialBalance: "500000",
          balance: "500000"
        }
      ]);
    });
  });
});
