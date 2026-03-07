import { ConstantBackoff, handleWhenResult, retry } from "cockatiel";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ListBidsResponse } from "@src/bid/http-schemas/bid.schema";
import type {
  CreateDeploymentResponse,
  DepositDeploymentResponse,
  GetDeploymentResponse,
  UpdateDeploymentResponse
} from "@src/deployment/http-schemas/deployment.schema";

import { requestApi } from "@test/services/api-client";

describe("Managed Wallet API Deployment Flow", () => {
  it("executes a full deployment cycle with provider", { timeout: 2 * 60 * 1000 }, async () => {
    const { apiKey } = await setup();

    const deployment = await createDeployment(apiKey);
    expect(deployment).toMatchObject({
      dseq: expect.any(String),
      manifest: expect.any(String)
    });

    try {
      const bid = await waitForBids(apiKey, deployment.dseq);

      expect(bid).toMatchObject({
        bid: expect.any(Object)
      });

      const lease = await createLease(apiKey, deployment, bid);
      expect(lease).toMatchObject({
        deployment: expect.objectContaining({
          id: expect.objectContaining({
            dseq: deployment.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            id: expect.objectContaining({
              dseq: deployment.dseq,
              gseq: bid.bid.id.gseq,
              oseq: bid.bid.id.oseq,
              provider: bid.bid.id.provider
            }),
            state: expect.any(String),
            price: expect.objectContaining({
              denom: "uakt",
              amount: expect.any(String)
            }),
            created_at: expect.any(String)
          })
        ]),
        escrow_account: expect.objectContaining({
          id: expect.any(Object),
          state: expect.objectContaining({
            funds: expect.arrayContaining([
              expect.objectContaining({
                denom: "uakt",
                amount: expect.any(String)
              })
            ])
          })
        })
      });

      // Step 5: Deposit additional funds into deployment escrow account
      const deposit = await depositIntoDeployment(apiKey, deployment.dseq);
      expect(deposit).toMatchObject({
        escrow_account: expect.objectContaining({
          id: expect.any(Object),
          state: expect.objectContaining({
            funds: expect.arrayContaining([
              expect.objectContaining({
                denom: "uakt",
                amount: expect.any(String)
              })
            ])
          })
        })
      });

      // Step 6: Update deployment with new SDL configuration using appropriate authentication
      const updatedDeployment = await updateDeployment(apiKey, deployment.dseq);
      expect(updatedDeployment).toMatchObject({
        deployment: expect.objectContaining({
          id: expect.objectContaining({
            dseq: deployment.dseq
          })
        })
      });

      // Step 7: Retrieve complete deployment details including leases and escrow
      const deploymentDetails = await getDeploymentDetails(apiKey, deployment.dseq);
      expect(deploymentDetails).toMatchObject({
        deployment: expect.objectContaining({
          id: expect.objectContaining({
            dseq: deployment.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            id: expect.objectContaining({
              dseq: deployment.dseq
            })
          })
        ])
      });

      // Step 8: Close deployment and terminate all associated leases
      const closedDeploymentResponse = await closeDeployment(apiKey, deployment.dseq);
      expect(closedDeploymentResponse).toMatchObject({
        status: 200
      });
    } catch (e) {
      // Final step: Close deployment in case of error to release escrow funds and cleanup
      await closeDeployment(apiKey, deployment.dseq);
      throw e;
    }
  });

  /**
   * Sets up the test environment by preparing providers, creating a user, and generating an API key.
   * @returns Promise resolving to an object containing:
   *   - apiKey: API key for authentication
   *   - walletAddress: Wallet address from the created user
   */
  async function setup() {
    const apiKey = z.string().parse(process.env.CONSOLE_API_E2E_API_KEY);

    return {
      apiKey
    };
  }

  /**
   * Creates a new deployment using the provided API key.
   * Reads the SDL file and creates a deployment with a 5 AKT deposit.
   * Seeds the database with deployment and deployment group data, ensuring proper foreign key relationships.
   */
  async function createDeployment(apiKey: string): Promise<CreateDeploymentResponse["data"]> {
    const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");
    const { data } = await requestApi<CreateDeploymentResponse>("/v1/deployments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        data: {
          sdl: yml,
          deposit: 5
        }
      })
    });

    return data.data;
  }

  /**
   * Waits for bids to be received for a deployment from providers supporting the target authentication type.
   * Retries up to 10 times with 6-second intervals until a bid is found.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @returns Promise resolving to the first bid
   */
  async function waitForBids(apiKey: string, dseq: string): Promise<ListBidsResponse["data"][number]> {
    return retry(
      handleWhenResult(res => !res),
      { maxAttempts: 10, backoff: new ConstantBackoff(6_000) }
    ).execute(async () => {
      const { data } = await requestApi<ListBidsResponse>(`/v1/bids?dseq=${dseq}`, {
        headers: {
          "x-api-key": apiKey
        }
      });

      return data.data[0]!;
    });
  }

  /**
   * Creates a lease and sends the manifest to the provider.
   * Seeds the database with lease data using actual API response data and proper foreign key references.
   * @param apiKey - API key for authentication
   * @param deployment - Deployment data containing manifest, dseq, and database IDs
   * @param bid - Selected bid from a provider
   * @returns Promise resolving to the deployment data with lease information
   */
  async function createLease(
    apiKey: string,
    deployment: CreateDeploymentResponse["data"],
    bid: ListBidsResponse["data"][number]
  ): Promise<GetDeploymentResponse["data"] | undefined> {
    const body = {
      manifest: deployment.manifest,
      leases: [
        {
          dseq: deployment.dseq,
          gseq: bid.bid.id.gseq,
          oseq: bid.bid.id.oseq,
          provider: bid.bid.id.provider
        }
      ]
    };

    const { data } = await requestApi<GetDeploymentResponse>("/v1/leases", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    return data.data;
  }

  /**
   * Deposits additional funds into a deployment's escrow account.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @returns Promise resolving to the escrow account data after deposit
   */
  async function depositIntoDeployment(apiKey: string, dseq: string): Promise<DepositDeploymentResponse["data"]> {
    const { data } = await requestApi<DepositDeploymentResponse>("/v1/deposit-deployment", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        data: {
          dseq,
          deposit: 0.5
        }
      })
    });

    return data.data;
  }

  /**
   * Updates an existing deployment with a new SDL configuration.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @returns Promise resolving to the updated deployment data
   */
  async function updateDeployment(apiKey: string, dseq: string): Promise<UpdateDeploymentResponse["data"]> {
    const updatedYml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl-update.yml"), "utf8");

    const { data } = await requestApi<UpdateDeploymentResponse>(`/v1/deployments/${dseq}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        data: {
          sdl: updatedYml
        }
      })
    });

    return data.data;
  }

  /**
   * Retrieves detailed information about a deployment including leases and escrow account.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @returns Promise resolving to the complete deployment details
   */
  async function getDeploymentDetails(apiKey: string, dseq: string): Promise<GetDeploymentResponse["data"]> {
    const { data } = await requestApi<GetDeploymentResponse>(`/v1/deployments/${dseq}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey
      }
    });

    return data.data;
  }

  /**
   * Closes a deployment, terminating all associated leases.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @returns Promise resolving to the response status
   */
  async function closeDeployment(apiKey: string, dseq: string): Promise<{ status: number }> {
    const { response } = await requestApi<void>(`/v1/deployments/${dseq}`, {
      method: "DELETE",
      headers: {
        "x-api-key": apiKey
      }
    });

    return {
      status: response.status
    };
  }
});
