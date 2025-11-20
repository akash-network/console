import type { Validator } from "@akashnetwork/database/dbSchemas/base";
import nock from "nock";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core";
import { app } from "@src/rest-app";

import { createValidator } from "@test/seeders";

describe("Validators API", () => {
  let validators: Validator[];

  beforeAll(async () => {
    validators = await Promise.all([
      createValidator({
        operatorAddress: "akashvaloper1w3cg3uq7uwlwkrtlrmtatqh80al42m3hzmcjmx"
      }),
      createValidator({
        operatorAddress: "akashvaloper15z8n2zjrs5vzml2tq9emax87jy6p3fjq39pndk"
      }),
      createValidator({
        operatorAddress: "akashvaloper1cva0zc4ll8u4flm5x9q7fj5zxt5mpqt0t2szlp"
      })
    ]);

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1000`)
      .reply(200, {
        validators: [
          {
            operator_address: validators[0].operatorAddress,
            consensus_pubkey: {
              "@type": "/cosmos.crypto.ed25519.PubKey",
              key: "ezVYNinrfDOheyueAxXD1ESIRG79I89lX2sY6pPdyN4="
            },
            jailed: false,
            status: "BOND_STATUS_BONDED",
            tokens: "1000133120142",
            delegator_shares: "1000133120142.000000000000000000",
            description: {
              moniker: "validator-01",
              identity: "",
              website: "",
              security_contact: "",
              details: ""
            },
            unbonding_height: "0",
            unbonding_time: "1970-01-01T00:00:00Z",
            commission: {
              commission_rates: {
                rate: "0.100000000000000000",
                max_rate: "0.200000000000000000",
                max_change_rate: "0.010000000000000000"
              },
              update_time: "2023-07-06T15:45:33.410589734Z"
            },
            min_self_delegation: "1"
          },
          {
            operator_address: validators[1].operatorAddress,
            consensus_pubkey: {
              "@type": "/cosmos.crypto.ed25519.PubKey",
              key: "c7c+uC7Na6pw+fxLycFfcjSWJniDE1p9VMvwn+tryCI="
            },
            jailed: false,
            status: "BOND_STATUS_BONDED",
            tokens: "1000050111882",
            delegator_shares: "1000050111882.000000000000000000",
            description: {
              moniker: "validator-02",
              identity: "",
              website: "",
              security_contact: "",
              details: ""
            },
            unbonding_height: "0",
            unbonding_time: "1970-01-01T00:00:00Z",
            commission: {
              commission_rates: {
                rate: "0.020000000000000000",
                max_rate: "0.200000000000000000",
                max_change_rate: "0.010000000000000000"
              },
              update_time: "2023-08-04T09:20:52.462349805Z"
            },
            min_self_delegation: "1"
          },
          {
            operator_address: validators[2].operatorAddress,
            consensus_pubkey: {
              "@type": "/cosmos.crypto.ed25519.PubKey",
              key: "eQZ4aBxltR+aRCPDmsYxYAiTkZDI2C4XKBRpLa6W27A="
            },
            jailed: false,
            status: "BOND_STATUS_BONDED",
            tokens: "1000020700143",
            delegator_shares: "1000020700143.000000000000000000",
            description: {
              moniker: "validator-03",
              identity: "",
              website: "",
              security_contact: "",
              details: ""
            },
            unbonding_height: "0",
            unbonding_time: "1970-01-01T00:00:00Z",
            commission: {
              commission_rates: {
                rate: "0.010000000000000000",
                max_rate: "0.200000000000000000",
                max_change_rate: "0.010000000000000000"
              },
              update_time: "2023-07-19T15:55:53.381110046Z"
            },
            min_self_delegation: "1"
          }
        ],
        pagination: {
          next_key: null,
          total: "0"
        }
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/cosmos/staking/v1beta1/validators/${validators[0].operatorAddress}`)
      .reply(200, {
        validator: {
          operator_address: validators[0].operatorAddress,
          consensus_pubkey: {
            "@type": "/cosmos.crypto.ed25519.PubKey",
            key: "ezVYNinrfDOheyueAxXD1ESIRG79I89lX2sY6pPdyN4="
          },
          jailed: false,
          status: "BOND_STATUS_BONDED",
          tokens: "1000133120142",
          delegator_shares: "1000133120142.000000000000000000",
          description: {
            moniker: "validator-01",
            identity: "",
            website: "",
            security_contact: "",
            details: ""
          },
          unbonding_height: "0",
          unbonding_time: "1970-01-01T00:00:00Z",
          commission: {
            commission_rates: {
              rate: "0.100000000000000000",
              max_rate: "0.200000000000000000",
              max_change_rate: "0.010000000000000000"
            },
            update_time: "2023-07-06T15:45:33.410589734Z"
          },
          min_self_delegation: "1"
        }
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL).persist().get(`/cosmos/staking/v1beta1/validators/${validators[1].operatorAddress}`).reply(404);
  });

  afterAll(async () => {
    nock.cleanAll();
  });

  describe("GET /v1/validators", () => {
    it("returns list of validators", async () => {
      const response = await app.request("/v1/validators");

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual([
        {
          operatorAddress: "akashvaloper1w3cg3uq7uwlwkrtlrmtatqh80al42m3hzmcjmx",
          moniker: "validator-01",
          votingPower: 1000133120142,
          commission: 0.1,
          identity: "",
          votingPowerRatio: 0.3333550461083556,
          rank: 1,
          keybaseAvatarUrl: validators[0].keybaseAvatarUrl
        },
        {
          operatorAddress: "akashvaloper15z8n2zjrs5vzml2tq9emax87jy6p3fjq39pndk",
          moniker: "validator-02",
          votingPower: 1000050111882,
          commission: 0.02,
          identity: "",
          votingPowerRatio: 0.33332737856912265,
          rank: 2,
          keybaseAvatarUrl: validators[1].keybaseAvatarUrl
        },
        {
          operatorAddress: "akashvaloper1cva0zc4ll8u4flm5x9q7fj5zxt5mpqt0t2szlp",
          moniker: "validator-03",
          votingPower: 1000020700143,
          commission: 0.01,
          identity: "",
          votingPowerRatio: 0.33331757532252176,
          rank: 3,
          keybaseAvatarUrl: validators[2].keybaseAvatarUrl
        }
      ]);
    });
  });

  describe("GET /v1/validators/{address}", () => {
    it("returns validator by address", async () => {
      const response = await app.request(`/v1/validators/${validators[0].operatorAddress}`, {
        method: "GET"
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({
        address: validators[0].accountAddress,
        operatorAddress: validators[0].operatorAddress,
        moniker: "validator-01",
        votingPower: 1000133120142,
        commission: 0.1,
        maxCommission: 0.2,
        maxCommissionChange: 0.01,
        identity: "",
        description: "",
        website: "",
        rank: 1,
        keybaseUsername: validators[0].keybaseUsername,
        keybaseAvatarUrl: validators[0].keybaseAvatarUrl
      });
    });

    it("returns 404 if validator not found", async () => {
      const response = await app.request(`/v1/validators/${validators[1].operatorAddress}`);

      expect(response.status).toBe(404);
    });

    it("returns 400 for an invalid address", async () => {
      const response = await app.request("/v1/validators/invalid-address");

      expect(response.status).toBe(400);
    });
  });
});
