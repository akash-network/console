import { AkashBlock, AkashMessage, Deployment, DeploymentGroup, Lease, Provider } from "@akashnetwork/database/dbSchemas/akash";
import { AddressReference, Day, Transaction, Validator } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import { format } from "date-fns";
import nock from "nock";

import type { GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { closeConnections, connectUsingSequelize } from "@src/db/dbConnection";
import type { ListWithResourcesResponse } from "@src/deployment/http-schemas/deployment.schema";
import { app } from "@src/rest-app";
import { apiNodeUrl, deploymentVersion, marketVersion } from "@src/utils/constants";

import { createAddressReferenceInDatabase } from "@test/seeders/address-reference.seeder";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createAkashBlock } from "@test/seeders/akash-block.seeder";
import { createAkashMessage } from "@test/seeders/akash-message.seeder";
import { createDay } from "@test/seeders/day.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";
import { createDeploymentGroup } from "@test/seeders/deployment-group.seeder";
import { createLease } from "@test/seeders/lease.seeder";
import { createProvider } from "@test/seeders/provider.seeder";
import { createTransaction } from "@test/seeders/transaction.seeder";
import { createValidator } from "@test/seeders/validator.seeder";

describe("Addresses API", () => {
  afterEach(async () => {
    await AddressReference.destroy({ where: {} });
    await AkashMessage.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await AkashBlock.destroy({ where: {} });
    await Day.destroy({ where: {} });
    await Lease.destroy({ where: {} });
    await DeploymentGroup.destroy({ where: {} });
    await Deployment.destroy({ where: {} });
    await Provider.destroy({ where: {} });
    await Validator.destroy({ where: {} });
  });

  afterAll(async () => {
    await closeConnections();
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  describe("GET /v1/addresses/{address}", () => {
    it("returns address information", async () => {
      const { validators, transactions, address } = await setup();

      const response = await app.request(`/v1/addresses/${address}`);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({
        assets: [
          {
            amount: 1,
            logoUrl: "https://console.akash.network/images/akash-logo.svg",
            symbol: "AKT"
          }
        ],
        available: 1000000,
        commission: 10,
        delegated: 100,
        delegations: [
          {
            amount: 100,
            reward: 300,
            validator: {
              address: validators[0].accountAddress,
              moniker: validators[0].moniker,
              operatorAddress: validators[0].operatorAddress,
              avatarUrl: validators[0].keybaseAvatarUrl
            }
          }
        ],
        latestTransactions: expect.arrayContaining([
          expect.objectContaining({
            hash: transactions[0].hash
          }),
          expect.objectContaining({
            hash: transactions[1].hash
          })
        ]),
        redelegations: [
          {
            amount: 100,
            completionTime: "2021-01-01T00:00:00Z",
            creationHeight: 100,
            dstAddress: {
              address: validators[1].accountAddress,
              avatarUrl: validators[1].keybaseAvatarUrl,
              moniker: validators[1].moniker,
              operatorAddress: validators[1].operatorAddress
            },
            srcAddress: {
              address: validators[0].accountAddress,
              avatarUrl: validators[0].keybaseAvatarUrl,
              moniker: validators[0].moniker,
              operatorAddress: validators[0].operatorAddress
            }
          }
        ],
        rewards: 300,
        total: 1000410
      });
    });

    it("returns 400 when address is not a valid akash address", async () => {
      await setup();

      const response = await app.request("/v1/addresses/invalid-address");

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/addresses/{address}/transactions/{skip}/{limit}", () => {
    it("returns paginated transactions for an address", async () => {
      const { address, transactions } = await setup();

      const response = await app.request(`/v1/addresses/${address}/transactions/0/10`);

      expect(response.status).toBe(200);
      const result = (await response.json()) as GetAddressTransactionsResponse;
      expect(result.count).toEqual(2);
      expect(result.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            hash: transactions[0].hash
          }),
          expect.objectContaining({
            hash: transactions[1].hash
          })
        ])
      );
    });

    it("returns 400 when address is not a valid akash address", async () => {
      await setup();

      const response = await app.request("/v1/addresses/invalid-address/transactions/0/10");

      expect(response.status).toBe(400);
    });

    it("returns 400 when skip is not a number", async () => {
      const { address } = await setup();

      const response = await app.request(`/v1/addresses/${address}/transactions/invalid/10`);

      expect(response.status).toBe(400);
    });

    it("returns 400 when limit is not a number", async () => {
      const { address } = await setup();

      const response = await app.request(`/v1/addresses/${address}/transactions/0/invalid`);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/addresses/{address}/deployments/{skip}/{limit}", () => {
    it("returns paginated deployments for an address", async () => {
      const { address } = await setup();

      const response = await app.request(`/v1/addresses/${address}/deployments/0/10`);

      expect(response.status).toBe(200);
      const result = (await response.json()) as ListWithResourcesResponse;
      expect(result.count).toEqual(2);
      expect(result.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            owner: address
          })
        ])
      );
    });

    it("returns 400 when address is not a valid akash address", async () => {
      await setup();

      const response = await app.request("/v1/addresses/invalid-address/deployments/0/10");

      expect(response.status).toBe(400);
    });

    it("returns 400 when skip is not a number", async () => {
      const { address } = await setup();

      const response = await app.request(`/v1/addresses/${address}/deployments/invalid/10`);

      expect(response.status).toBe(400);
    });

    it("returns 400 when limit is not a number", async () => {
      const { address } = await setup();

      const response = await app.request(`/v1/addresses/${address}/deployments/0/invalid`);

      expect(response.status).toBe(400);
    });

    it("returns 400 when status is not active or closed", async () => {
      const { address } = await setup();

      const response = await app.request(`/v1/addresses/${address}/deployments/0/10?status=invalid`);

      expect(response.status).toBe(400);
    });
  });

  const setup = async () => {
    await connectUsingSequelize();

    const address = createAkashAddress();
    const validators = await Promise.all([
      createValidator({
        accountAddress: address
      }),
      createValidator()
    ]);

    nock(apiNodeUrl)
      .persist()
      .get(`/cosmos/bank/v1beta1/balances/${address}?pagination.limit=1000`)
      .reply(200, {
        balances: [
          {
            denom: "uakt",
            amount: "1000000"
          }
        ],
        pagination: {
          next_key: null,
          total: "1"
        }
      });

    nock(apiNodeUrl)
      .persist()
      .get(`/cosmos/staking/v1beta1/delegations/${address}?pagination.limit=1000`)
      .reply(200, {
        delegation_responses: [
          {
            delegation: {
              delegator_address: address,
              validator_address: validators[0].operatorAddress,
              shares: "1000000"
            },
            balance: {
              denom: "uakt",
              amount: "100"
            }
          }
        ],
        pagination: {
          next_key: null,
          total: "1"
        }
      });

    nock(apiNodeUrl)
      .persist()
      .get(`/cosmos/staking/v1beta1/delegators/${address}/redelegations?pagination.limit=1000`)
      .reply(200, {
        redelegation_responses: [
          {
            redelegation: {
              delegator_address: address,
              validator_src_address: validators[0].operatorAddress,
              validator_dst_address: validators[1].operatorAddress
            },
            entries: [
              {
                redelegation_entry: {
                  creation_height: 100,
                  completion_time: "2021-01-01T00:00:00Z",
                  initial_balance: "100",
                  shares_dst: "1000000"
                },
                balance: "100"
              }
            ]
          }
        ],
        pagination: {
          next_key: null,
          total: "0"
        }
      });

    nock(apiNodeUrl)
      .persist()
      .get(`/cosmos/distribution/v1beta1/delegators/${address}/rewards`)
      .reply(200, {
        total: [
          {
            denom: "uakt",
            amount: "300"
          }
        ],
        rewards: [
          {
            validator_address: validators[0].operatorAddress,
            reward: [
              {
                denom: "uakt",
                amount: "300"
              }
            ]
          }
        ]
      });

    nock(apiNodeUrl)
      .persist()
      .get(`/cosmos/distribution/v1beta1/validators/${validators[0].operatorAddress}/commission`)
      .reply(200, {
        commission: { commission: [{ denom: "uakt", amount: "10" }] }
      });

    const provider = await createProvider();

    const deployments = await Promise.all([
      createDeployment({
        owner: address,
        dseq: "1234",
        createdHeight: 100,
        balance: 1000000,
        deposit: 1000000,
        denom: "uakt"
      }),
      createDeployment({
        owner: address,
        dseq: "1234",
        createdHeight: 100,
        balance: 1000000,
        deposit: 1000000,
        denom: "uakt"
      })
    ]);

    const deploymentGroup = await Promise.all([
      createDeploymentGroup({
        deploymentId: deployments[0].id,
        owner: address
      }),
      createDeploymentGroup({
        deploymentId: deployments[1].id,
        owner: address
      })
    ]);

    await Promise.all([
      createLease({
        owner: address,
        dseq: deployments[0].dseq,
        gseq: 1,
        oseq: 1,
        state: "active",
        deploymentId: deployments[0].id,
        deploymentGroupId: deploymentGroup[0].id,
        providerAddress: provider.owner
      }),
      createLease({
        owner: address,
        dseq: deployments[1].dseq,
        gseq: 1,
        oseq: 1,
        state: "active",
        deploymentId: deployments[1].id,
        deploymentGroupId: deploymentGroup[1].id,
        providerAddress: provider.owner
      })
    ]);

    nock(apiNodeUrl)
      .persist()
      .get(
        `/akash/deployment/${deploymentVersion}/deployments/list?filters.owner=${address}&pagination.limit=10&pagination.offset=0&pagination.count_total=true&pagination.reverse=false`
      )
      .reply(200, {
        deployments: [
          {
            deployment: {
              id: {
                owner: address,
                dseq: "111"
              },
              state: "active",
              hash: "1.0.0",
              created_at: "2021-01-01T00:00:00Z"
            },
            escrow_account: {
              id: {
                scope: "deployment",
                xid: deployments[0].id
              },
              state: {
                owner: address,
                state: "open",
                transferred: [],
                settled_at: "0",
                funds: [],
                deposits: []
              }
            },
            groups: [
              {
                id: {
                  owner: address,
                  dseq: "111",
                  gseq: 1
                },
                state: "open",
                created_at: "2021-01-01T00:00:00Z",
                group_spec: {
                  name: "main",
                  requirements: {
                    signed_by: {
                      all_of: [],
                      any_of: []
                    },
                    attributes: []
                  },
                  resources: []
                }
              }
            ]
          },
          {
            deployment: {
              id: {
                owner: address,
                dseq: "222"
              },
              state: "active",
              hash: "1.0.0",
              created_at: "2021-01-01T00:00:00Z"
            },
            escrow_account: {
              id: {
                scope: "deployment",
                xid: deployments[1].id
              },
              state: {
                owner: address,
                state: "open",
                transferred: [],
                settled_at: "0",
                funds: [],
                deposits: []
              }
            },
            groups: [
              {
                id: {
                  owner: address,
                  dseq: "222",
                  gseq: 1
                },
                state: "open",
                created_at: "2021-01-01T00:00:00Z",
                group_spec: {
                  name: "main",
                  requirements: {
                    signed_by: {
                      all_of: [],
                      any_of: []
                    },
                    attributes: []
                  },
                  resources: []
                }
              }
            ]
          }
        ],
        pagination: {
          next_key: null,
          total: "2"
        }
      });

    nock(apiNodeUrl)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.state=active`)
      .reply(200, {
        leases: [
          {
            lease: {
              lease_id: {
                owner: address,
                dseq: "111"
              }
            }
          },
          {
            lease: {
              lease_id: {
                owner: address,
                dseq: "222"
              }
            }
          }
        ]
      });

    const now = new Date();
    const height = 100;

    await createDay({
      date: format(now, "yyyy-MM-dd"),
      firstBlockHeight: height,
      lastBlockHeight: height,
      lastBlockHeightYet: height
    });

    await createAkashBlock({
      height,
      datetime: new Date().toISOString(),
      hash: faker.string.hexadecimal({ length: 64 }),
      proposer: "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm",
      txCount: 1
    });

    const transactions = await Promise.all([
      createTransaction({
        height,
        index: 1,
        hash: faker.string.hexadecimal({ length: 64 }),
        msgCount: 1
      }),
      createTransaction({
        height,
        index: 2,
        hash: faker.string.hexadecimal({ length: 64 }),
        msgCount: 1
      })
    ]);

    const currentHeight = 100;
    const messages = await Promise.all([
      createAkashMessage({
        txId: transactions[0].id,
        height: currentHeight,
        type: "/cosmos.bank.v1beta1.MsgSend",
        typeCategory: "cosmos",
        amount: "100"
      }),
      createAkashMessage({
        txId: transactions[1].id,
        height: currentHeight,
        type: "/cosmos.bank.v1beta1.MsgSend",
        typeCategory: "cosmos",
        amount: "200"
      })
    ]);

    await Promise.all([
      createAddressReferenceInDatabase({
        transactionId: transactions[0].id,
        messageId: messages[0].id,
        address: address,
        type: "sender"
      }),
      createAddressReferenceInDatabase({
        transactionId: transactions[1].id,
        messageId: messages[1].id,
        address: address,
        type: "sender"
      })
    ]);

    return {
      address,
      validators,
      transactions
    };
  };
});
