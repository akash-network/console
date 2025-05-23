import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import type { Axios, AxiosResponse } from "axios";
import { mock } from "jest-mock-extended";

import { UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";
import type { RestApiBalancesResponseType } from "@src/types";
import type { RpcDeployment } from "@src/types/deployment";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { WalletBalancesService } from "./wallet-balances.service";

import { buildRpcDeployment } from "@tests/seeders/deployment";

describe(WalletBalancesService.name, () => {
  const walletAddress = "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcab";

  describe("getBalances", () => {
    it("returns balances", async () => {
      const deployments = [
        buildRpcDeployment({
          deployment: {
            deployment_id: {
              dseq: "666922",
              owner: walletAddress
            },
            state: "open"
          }
        }),
        buildRpcDeployment({
          deployment: {
            deployment_id: {
              dseq: "666923",
              owner: walletAddress
            },
            state: "open"
          }
        })
      ];
      const service = setup({
        getValidDepositDeploymentGrantsForGranterAndGrantee: () => Promise.resolve(undefined),
        getDeploymentList: () => deployments
      });
      const balances = await service.getBalances(walletAddress);

      expect(balances).toEqual({
        balanceUAKT: 73477804,
        balanceUUSDC: 0,
        deploymentEscrowUAKT: 0.8768,
        deploymentEscrowUUSDC: 0,
        deploymentGrant: undefined,
        deploymentGrantsUAKT: 0,
        deploymentGrantsUUSDC: 0,
        activeDeployments: deployments.map(d => deploymentToDto(d))
      });
    });
  });

  function setup(input: TestInput) {
    return new WalletBalancesService(
      mock({
        getValidDepositDeploymentGrantsForGranterAndGrantee: input.getValidDepositDeploymentGrantsForGranterAndGrantee
      }),
      mock({
        async get(url: string) {
          if (url.includes("deployments/list")) {
            return Promise.resolve({
              data: {
                deployments: input.getDeploymentList?.() || [
                  buildRpcDeployment({
                    deployment: {
                      deployment_id: {
                        dseq: "666922",
                        owner: walletAddress
                      },
                      state: "open"
                    }
                  }),
                  buildRpcDeployment({
                    deployment: {
                      deployment_id: {
                        dseq: "666923",
                        owner: walletAddress
                      },
                      state: "open"
                    }
                  })
                ],
                pagination: {
                  next_key: null,
                  total: "2"
                }
              }
            } as unknown as AxiosResponse<RpcDeployment[]>);
          }

          if (url.includes("cosmos/bank/v1beta1/balances")) {
            return Promise.resolve({
              data: input.getBalances?.() || {
                balances: [
                  { denom: USDC_IBC_DENOMS.sandbox, amount: "49944457" },
                  { denom: UAKT_DENOM, amount: "73477804" }
                ]
              }
            } as unknown as AxiosResponse<RestApiBalancesResponseType>);
          }

          return Promise.reject(new Error("Not implemented"));
        }
      }) as unknown as Axios,
      input.masterWalletAddress || "akash1234",
      input.apiEndpoint || "http://test.com"
    );
  }

  interface TestInput {
    getValidDepositDeploymentGrantsForGranterAndGrantee?: AuthzHttpService["getValidDepositDeploymentGrantsForGranterAndGrantee"];
    getBalances?: () => RestApiBalancesResponseType;
    getDeploymentList?: () => RpcDeployment[];
    masterWalletAddress?: string;
    apiEndpoint?: string;
  }
});
