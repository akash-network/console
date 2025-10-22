import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import type { AxiosInstance, AxiosResponse } from "axios";
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
            id: {
              dseq: "666922",
              owner: walletAddress
            },
            state: "open"
          }
        }),
        buildRpcDeployment({
          deployment: {
            id: {
              dseq: "666923",
              owner: walletAddress
            },
            state: "open"
          }
        })
      ];
      const service = setup({
        getAllDepositDeploymentGrants: () => Promise.resolve([]),
        getDeploymentList: () => deployments
      });
      const balances = await service.getBalances(walletAddress);

      expect(balances).toEqual({
        balanceUAKT: 73477804,
        balanceUUSDC: 0,
        deploymentEscrowUAKT: 0.8768,
        deploymentEscrowUUSDC: 0,
        deploymentGrants: [],
        deploymentGrantsUAKT: 0,
        deploymentGrantsUUSDC: 0,
        activeDeployments: deployments.map(d => deploymentToDto(d))
      });
    });
  });

  function setup(input: {
    getAllDepositDeploymentGrants?: AuthzHttpService["getAllDepositDeploymentGrants"];
    getBalances?: () => RestApiBalancesResponseType;
    getDeploymentList?: () => RpcDeployment[];
    masterWalletAddress?: string;
  }) {
    return new WalletBalancesService(
      mock({
        getAllDepositDeploymentGrants: input.getAllDepositDeploymentGrants
      }),
      mock({
        async get(url: string) {
          if (url.includes("deployments/list")) {
            return Promise.resolve({
              data: {
                deployments: input.getDeploymentList?.() || [
                  buildRpcDeployment({
                    deployment: {
                      id: {
                        dseq: "666922",
                        owner: walletAddress
                      },
                      state: "open"
                    }
                  }),
                  buildRpcDeployment({
                    deployment: {
                      id: {
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
      }) as unknown as AxiosInstance,
      input.masterWalletAddress || "akash1234"
    );
  }
});
