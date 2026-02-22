import { ConstantBackoff, handleWhenResult, retry } from "cockatiel";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ListBidsResponse } from "@src/bid/http-schemas/bid.schema";
import type { CreateCertificateResponse } from "@src/certificate/http-schemas/create-certificate.schema";
import type {
  CreateDeploymentResponse,
  DepositDeploymentResponse,
  GetDeploymentResponse,
  UpdateDeploymentResponse
} from "@src/deployment/http-schemas/deployment.schema";

import { requestApi } from "@test/services/api-client";

describe("Managed Wallet API Deployment Flow", () => {
  /**
   * Authentication types supported by the test.
   * - mTLS: Mutual TLS authentication (deprecated, supported by all providers)
   * - JWT: JSON Web Token authentication (preferred, supported by providers with version >= 0.8.3-rc0)
   */
  const authTypes = ["mTLS", "JWT"] as const;

  it.each(authTypes)("executes a full deployment cycle with provider %s auth", { timeout: 3 * 60 * 1000 }, async auth => {
    // Setup: Prepare test environment with providers, user, and API key
    const { apiKey } = await setup();

    // Step 1: Create deployment with SDL configuration
    const deployment = await createDeployment(apiKey);
    expect(deployment).toMatchObject({
      dseq: expect.any(String),
      manifest: expect.any(String)
    });

    try {
      // Step 2: Wait for provider bids and select one supporting the target authentication type
      const bid = (await waitForBids(apiKey, deployment.dseq, auth))!;

      expect(bid).toMatchObject({
        bid: expect.any(Object),
        isCertificateRequired: expect.any(Boolean)
      });

      let certificate;

      // Step 3: Create mTLS certificate for providers requiring it (akash versions < 0.8.3-rc0)
      // JWT authentication is preferred and supported by providers with a version >= 0.8.3-rc0
      // In production, integrations should check bid.isCertificateRequired to determine auth type
      if (auth === "mTLS") {
        certificate = await createCertificate(apiKey);
        expect(certificate).toMatchObject({
          certPem: expect.any(String),
          pubkeyPem: expect.any(String),
          encryptedKey: expect.any(String)
        });
      }

      // Step 4: Create lease and send manifest to provider using appropriate authentication
      const lease = await createLease(apiKey, deployment, bid, certificate);
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
      const updatedDeployment = await updateDeployment(apiKey, deployment.dseq, certificate);
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
   * For JWT auth, selects bids from providers that don't require certificates (version >= 0.8.3-rc0).
   * For mTLS auth, selects the first available bid regardless of certificate requirements.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @param targetAuthType - Target authentication type ("mTLS" or "JWT")
   * @returns Promise resolving to the first bid matching the auth type or undefined if none found
   */
  async function waitForBids(apiKey: string, dseq: string, targetAuthType: (typeof authTypes)[number]): Promise<ListBidsResponse["data"][number] | undefined> {
    return retry(
      handleWhenResult(res => !res),
      { maxAttempts: 10, backoff: new ConstantBackoff(6_000) }
    ).execute(async () => {
      const { data } = await requestApi<ListBidsResponse>(`/v1/bids?dseq=${dseq}`, {
        headers: {
          "x-api-key": apiKey
        }
      });

      return data.data.find(bid => targetAuthType === "mTLS" || !bid.isCertificateRequired);
    });
  }

  /**
   * Creates a new certificate for mTLS authentication.
   * @param apiKey - API key for authentication
   * @returns Promise resolving to the certificate data including certPem and encryptedKey
   */
  async function createCertificate(apiKey: string): Promise<CreateCertificateResponse["data"]> {
    const { data } = await requestApi<CreateCertificateResponse>("/v1/certificates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      }
    });

    return data.data;
  }

  /**
   * Creates a lease and sends the manifest to the provider.
   * Supports both mTLS and JWT authentication based on provider capabilities.
   * Seeds the database with lease data using actual API response data and proper foreign key references.
   * @param apiKey - API key for authentication
   * @param deployment - Deployment data containing manifest, dseq, and database IDs
   * @param bid - Selected bid from a provider
   * @param certificate - Optional certificate data for mTLS authentication (required for providers with akash versions < 0.8.3-rc0)
   * @returns Promise resolving to the deployment data with lease information
   */
  async function createLease(
    apiKey: string,
    deployment: CreateDeploymentResponse["data"],
    bid: ListBidsResponse["data"][number],
    certificate?: CreateCertificateResponse["data"]
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
      ],
      certificate: certificate
        ? {
            certPem: certificate.certPem,
            keyPem: certificate.encryptedKey
          }
        : undefined
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
   * Supports both mTLS and JWT authentication based on provider capabilities.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @param certificate - Optional certificate data for mTLS authentication (required for providers with akash versions < 0.8.3-rc0)
   * @returns Promise resolving to the updated deployment data
   */
  async function updateDeployment(apiKey: string, dseq: string, certificate?: CreateCertificateResponse["data"]): Promise<UpdateDeploymentResponse["data"]> {
    const updatedYml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl-update.yml"), "utf8");

    const { data } = await requestApi<UpdateDeploymentResponse>(`/v1/deployments/${dseq}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        data: {
          sdl: updatedYml,
          certificate: certificate
            ? {
                certPem: certificate.certPem,
                keyPem: certificate.encryptedKey
              }
            : undefined
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
