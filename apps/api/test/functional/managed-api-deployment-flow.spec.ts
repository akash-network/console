import { faker } from "@faker-js/faker";
import { ConstantBackoff, handleWhenResult, retry } from "cockatiel";
import nock from "nock";
import * as assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { container } from "tsyringe";
import type { z } from "zod";

import type { ApiKeyVisibleResponse } from "@src/auth/http-schemas/api-key.schema";
import type { ListBidsResponse } from "@src/bid/http-schemas/bid.schema";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { CreateCertificateResponse } from "@src/certificate/http-schemas/create-certificate.schema";
import type {
  CreateDeploymentResponse,
  DepositDeploymentResponse,
  GetDeploymentResponse,
  UpdateDeploymentResponse
} from "@src/deployment/http-schemas/deployment.schema";
import type { ListDeploymentsResponseSchema } from "@src/deployment/http-schemas/deployment.schema";

type ListDeploymentsResponse = z.infer<typeof ListDeploymentsResponseSchema>;
import { app } from "@src/rest-app";
import { apiNodeUrl } from "@src/utils/constants";

import { createDeployment as createDeploymentSeed, createDeploymentGroup, createLease as createLeaseSeed, createProvider } from "@test/seeders";
import { AppHttpService } from "@test/services/app-http.service";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(120_000);

type ApiKey = NonNullable<ApiKeyVisibleResponse["data"]["apiKey"]>;
type AuthType = "mTLS" | "JWT";

describe("Managed Wallet API Deployment Flow", () => {
  const http = new AppHttpService(app);

  /**
   * Authentication types supported by the test.
   * - mTLS: Mutual TLS authentication (deprecated, supported by all providers)
   * - JWT: JSON Web Token authentication (preferred, supported by providers with version >= 0.8.3-rc0)
   */
  const authTypes: AuthType[] = ["mTLS", "JWT"];

  it.each(authTypes)("should execute a full deployment cycle with provider %s auth", async auth => {
    // Setup: Prepare test environment with providers, user, and API key
    const { apiKey, walletAddress } = await setup();

    // Step 1: Create deployment with SDL configuration
    const deployment = await createDeployment(apiKey, walletAddress);
    expect(deployment).toMatchObject({
      dseq: expect.any(String),
      manifest: expect.any(String)
    });

    try {
      // Step 2: Wait for provider bids and select one supporting the target authentication type
      const bid = await waitForBids(apiKey, deployment.dseq, auth);

      expect(bid).toMatchObject({
        bid: expect.any(Object),
        isCertificateRequired: expect.any(Boolean)
      });
      assert.ok(bid, "Bid not found");

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
      const lease = await createLease(apiKey, deployment, bid, walletAddress, certificate);
      expect(lease).toMatchObject({
        deployment: expect.objectContaining({
          deployment_id: expect.objectContaining({
            dseq: deployment.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            lease_id: expect.objectContaining({
              dseq: deployment.dseq,
              gseq: bid.bid.bid_id.gseq,
              oseq: bid.bid.bid_id.oseq,
              provider: bid.bid.bid_id.provider
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
          balance: expect.objectContaining({
            denom: "uakt",
            amount: expect.any(String)
          })
        })
      });

      // Step 5: Deposit additional funds into deployment escrow account
      const deposit = await depositIntoDeployment(apiKey, deployment.dseq);
      expect(deposit).toMatchObject({
        escrow_account: expect.objectContaining({
          id: expect.any(Object),
          balance: expect.objectContaining({
            denom: "uakt",
            amount: expect.any(String)
          })
        })
      });

      // Step 6: Update deployment with new SDL configuration using appropriate authentication
      const updatedDeployment = await updateDeployment(apiKey, deployment.dseq, certificate);
      expect(updatedDeployment).toMatchObject({
        deployment: expect.objectContaining({
          deployment_id: expect.objectContaining({
            dseq: deployment.dseq
          })
        })
      });

      // Step 7: Retrieve complete deployment details including leases and escrow
      const deploymentDetails = await getDeploymentDetails(apiKey, deployment.dseq);
      expect(deploymentDetails).toMatchObject({
        deployment: expect.objectContaining({
          deployment_id: expect.objectContaining({
            dseq: deployment.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            lease_id: expect.objectContaining({
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

  it("should maintain read-only operations during blockchain node outages", async () => {
    // Setup: Prepare test environment with providers, user, and API key
    const { apiKey, walletAddress, blockNode, unblockNode } = await setup();

    // ===============================================================================
    // PHASE 1: BLOCKCHAIN UP - Establish baseline operations that require blockchain access
    // ===============================================================================

    // Step 1: Create deployment with SDL configuration
    const deployment = await createDeployment(apiKey, walletAddress);
    expect(deployment).toMatchObject({
      dseq: expect.any(String),
      manifest: expect.any(String)
    });

    try {
      // Step 2: Wait for provider bids and select one supporting the target authentication type
      const bid = await waitForBids(apiKey, deployment.dseq, "JWT");

      expect(bid).toMatchObject({
        bid: expect.any(Object),
        isCertificateRequired: expect.any(Boolean)
      });
      assert.ok(bid, "Bid not found");

      // Step 3: Create lease and send manifest to provider using appropriate authentication
      const lease = await createLease(apiKey, deployment, bid, walletAddress);
      expect(lease).toMatchObject({
        deployment: expect.objectContaining({
          deployment_id: expect.objectContaining({
            dseq: deployment.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            lease_id: expect.objectContaining({
              dseq: deployment.dseq,
              gseq: bid.bid.bid_id.gseq,
              oseq: bid.bid.bid_id.oseq,
              provider: bid.bid.bid_id.provider
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
          balance: expect.objectContaining({
            denom: "uakt",
            amount: expect.any(String)
          })
        })
      });

      // Step 4: Deposit additional funds into deployment escrow account
      const deposit = await depositIntoDeployment(apiKey, deployment.dseq);
      expect(deposit).toMatchObject({
        escrow_account: expect.objectContaining({
          id: expect.any(Object),
          balance: expect.objectContaining({
            denom: "uakt",
            amount: expect.any(String)
          })
        })
      });

      // ===============================================================================
      // PHASE 2: BLOCKCHAIN DOWN - Test which operations continue to work during outage
      // ===============================================================================

      blockNode();

      // Step 5: Retrieve complete deployment details including leases and escrow
      const deploymentDetails = await getDeploymentDetails(apiKey, deployment.dseq);
      expect(deploymentDetails).toMatchObject({
        deployment: expect.objectContaining({
          deployment_id: expect.objectContaining({
            dseq: deployment.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            lease_id: expect.objectContaining({
              dseq: deployment.dseq
            })
          })
        ])
      });

      // Step 6: Retrieve a deployment list to verify read-only list operations work during outage
      const deploymentList = await getDeploymentList(apiKey);
      expect(deploymentList).toMatchObject({
        deployments: expect.arrayContaining([
          expect.objectContaining({
            deployment: expect.objectContaining({
              deployment_id: expect.objectContaining({
                dseq: deployment.dseq
              }),
              state: expect.any(String)
            })
          })
        ]),
        pagination: expect.objectContaining({
          total: expect.any(Number),
          skip: expect.any(Number),
          limit: 10
        })
      });

      // ===============================================================================
      // PHASE 3: BLOCKCHAIN RESTORED - Verify write operations work again
      // ===============================================================================

      unblockNode();

      // Step 7: Demonstrate that write operations work again when blockchain is available
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
   * Also provides network outage simulation functions for testing blockchain resilience.
   * @returns Promise resolving to an object containing:
   *   - apiKey: API key for authentication
   *   - walletAddress: Wallet address from the created user
   *   - blockNode: Function to simulate blockchain node outage by blocking RPC/API connections
   *   - unblockNode: Function to restore blockchain connectivity
   */
  async function setup() {
    await prepareIndexedProviders();
    const { token, wallet } = await prepareUser();
    const apiKey = await createApiKey(token);

    return {
      apiKey,
      walletAddress: wallet.address,
      blockNode,
      unblockNode
    };
  }

  /**
   * Simulates a blockchain node outage to test which operations remain functional during network disruptions.
   * Blocks operations requiring blockchain transactions while preserving read-only functionality:
   * @returns A cleanup function that restores network connectivity
   */
  function blockNode() {
    const RPC_NODE_ENDPOINT = container.resolve(BillingConfigService).get("RPC_NODE_ENDPOINT");
    const nodeUrl = apiNodeUrl;
    const errorType = process.env.NODE_OUTAGE_ERROR_TYPE || "ECONNRESET";

    nock(nodeUrl)
      .persist()
      .get(/.*/)
      .replyWithError({ code: errorType, message: errorType })
      .post(/.*/)
      .replyWithError({ code: errorType, message: errorType });

    nock(RPC_NODE_ENDPOINT)
      .persist()
      .get(/.*/)
      .replyWithError({ code: errorType, message: errorType })
      .post(/.*/)
      .replyWithError({ code: errorType, message: errorType });

    return () => {
      nock.cleanAll();
    };
  }

  /**
   * Restores normal blockchain network operation by clearing all network interceptors.
   * This allows requests to reach the actual node endpoints again and validates system recovery.
   */
  function unblockNode() {
    nock.cleanAll();
  }

  /**
   * Prepares indexed providers for testing by creating provider records in the indexer database.
   * Sets up both Europlots and Sandbox providers with their respective Akash versions.
   * Handles duplicate provider creation gracefully by catching unique constraint errors.
   */
  async function prepareIndexedProviders(): Promise<void> {
    try {
      /**
       * Real Akash sandbox providers used for testing.
       * These are actual providers running on the Akash sandbox with their current versions
       * as of the time this test was implemented.
       */
      const AKASH_SANDBOX_PROVIDER = {
        owner: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
        akashVersion: "0.8.3-rc10",
        hostUri: "https://provider.provider-02.sandbox-01.aksh.pw:8443"
      };
      const AKASH_EUROPLOTS_PROVIDER = {
        owner: "akash1d4fletej4cwn9x8jzpzmnk6zkqeh90ejjskpmu",
        akashVersion: "0.6.11-rc1",
        hostUri: "https://provider.europlots-sandbox.com:8443"
      };
      await Promise.all([AKASH_EUROPLOTS_PROVIDER, AKASH_SANDBOX_PROVIDER].map(async provider => createProvider(provider)));
    } catch (e) {
      if (!(e instanceof Error && e.name === "SequelizeUniqueConstraintError")) {
        throw e;
      }
    }
  }

  /**
   * Prepares a test user and wallet for testing purposes.
   * Creates a user, wallet, and finishes the trial period.
   * @returns Promise containing user, wallet, and authentication token
   */
  async function prepareUser() {
    const walletService = new WalletTestingService(app);
    const res = await walletService.createUserAndWallet();
    await walletService.finishTrial(res.wallet);

    return res;
  }

  /**
   * Creates an API key for the authenticated user.
   * @param token - Authentication token for the user
   * @returns Promise resolving to the created API key
   */
  async function createApiKey(token: string): Promise<ApiKey> {
    const { data } = await http.request<ApiKeyVisibleResponse>("/v1/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        data: {
          name: "Test key"
        }
      })
    });

    return data.data.apiKey;
  }

  /**
   * Creates a new deployment using the provided API key.
   * Reads the SDL file and creates a deployment with a 5 AKT deposit.
   * Seeds the database with deployment and deployment group data, ensuring proper foreign key relationships.
   * @param apiKey - API key for authentication
   * @param walletAddress - Wallet address from setup
   * @returns Promise resolving to the deployment data including dseq and manifest
   */
  async function createDeployment(apiKey: string, walletAddress: string): Promise<CreateDeploymentResponse["data"]> {
    const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");
    const { data } = await http.request<CreateDeploymentResponse>("/v1/deployments", {
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

    const deploymentDbId = faker.string.uuid();
    await createDeploymentSeed({
      id: deploymentDbId,
      dseq: data.data.dseq,
      deposit: 5,
      balance: 5,
      denom: "uakt",
      owner: walletAddress
    });

    const deploymentGroup = await createDeploymentGroup({
      id: faker.string.uuid(),
      deploymentId: deploymentDbId,
      dseq: data.data.dseq,
      gseq: 1,
      owner: walletAddress
    });

    (data.data as any)._dbId = deploymentDbId;
    (data.data as any)._deploymentGroupId = deploymentGroup.id;

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
  async function waitForBids(apiKey: string, dseq: string, targetAuthType: AuthType): Promise<ListBidsResponse["data"][number] | undefined> {
    return retry(
      handleWhenResult(res => !res),
      { maxAttempts: 10, backoff: new ConstantBackoff(6_000) }
    ).execute(async () => {
      const { data } = await http.request<ListBidsResponse>(`/v1/bids?dseq=${dseq}`, {
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
    const { data } = await http.request<CreateCertificateResponse>("/v1/certificates", {
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
   * @param walletAddress - Wallet address from setup
   * @param certificate - Optional certificate data for mTLS authentication (required for providers with akash versions < 0.8.3-rc0)
   * @returns Promise resolving to the deployment data with lease information
   */
  async function createLease(
    apiKey: string,
    deployment: CreateDeploymentResponse["data"],
    bid: ListBidsResponse["data"][number],
    walletAddress: string,
    certificate?: CreateCertificateResponse["data"]
  ): Promise<GetDeploymentResponse["data"]> {
    const body = {
      manifest: deployment.manifest,
      leases: [
        {
          dseq: deployment.dseq,
          gseq: bid.bid.bid_id.gseq,
          oseq: bid.bid.bid_id.oseq,
          provider: bid.bid.bid_id.provider
        }
      ],
      certificate: certificate
        ? {
            certPem: certificate.certPem,
            keyPem: certificate.encryptedKey
          }
        : undefined
    };

    const { data } = await http.request<GetDeploymentResponse>("/v1/leases", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    for (const lease of data.data.leases) {
      await createLeaseSeed({
        id: faker.string.uuid(),
        dseq: lease.lease_id.dseq,
        gseq: lease.lease_id.gseq,
        oseq: lease.lease_id.oseq,
        providerAddress: lease.lease_id.provider,
        owner: walletAddress,
        price: parseFloat(lease.price.amount),
        denom: lease.price.denom,
        deploymentId: (deployment as any)._dbId,
        deploymentGroupId: (deployment as any)._deploymentGroupId,
        createdHeight: faker.number.int({ min: 1, max: 10000000 })
      });
    }

    return data.data;
  }

  /**
   * Deposits additional funds into a deployment's escrow account.
   * @param apiKey - API key for authentication
   * @param dseq - Deployment sequence number
   * @returns Promise resolving to the escrow account data after deposit
   */
  async function depositIntoDeployment(apiKey: string, dseq: string): Promise<DepositDeploymentResponse["data"]> {
    const { data } = await http.request<DepositDeploymentResponse>("/v1/deposit-deployment", {
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

    const { data } = await http.request<UpdateDeploymentResponse>(`/v1/deployments/${dseq}`, {
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
    const { data } = await http.request<GetDeploymentResponse>(`/v1/deployments/${dseq}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey
      }
    });

    return data.data;
  }

  /**
   * Retrieves a paginated list of deployments for the authenticated user.
   * @param apiKey - API key for authentication
   * @param options - Optional pagination options (skip, limit)
   * @returns Promise resolving to the list of deployments with pagination info
   */
  async function getDeploymentList(apiKey: string): Promise<ListDeploymentsResponse["data"]> {
    const { data } = await http.request<ListDeploymentsResponse>("/v1/deployments?skip=0&limit=10", {
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
    const { response } = await http.request<void>(`/v1/deployments/${dseq}`, {
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
