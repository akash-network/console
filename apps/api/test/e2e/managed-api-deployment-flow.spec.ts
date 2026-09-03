import type { paths } from "@akashnetwork/console-api-types";
import { operations } from "@akashnetwork/console-api-types";
import { createApi } from "@akashnetwork/openapi-sdk";
import { ConstantBackoff, handleWhenResult, retry } from "cockatiel";
import { CompactEncrypt } from "jose";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("Managed Wallet API Deployment Flow", () => {
  it("executes a full deployment cycle with provider", { timeout: 2 * 60 * 1000 }, async () => {
    const { api } = await setup();

    const deploymentResponse = await api.v1.createDeployment({
      data: {
        sdl: fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8")
      }
    });
    expect(deploymentResponse.data).toMatchObject({
      dseq: expect.any(String),
      manifest: expect.any(String)
    });

    try {
      const bid = await waitForBids(api, deploymentResponse.data.dseq);

      expect(bid).toMatchObject({
        bid: expect.any(Object)
      });

      const leaseResponse = await api.v1.createLease({
        leases: [
          {
            dseq: bid.bid.id.dseq,
            gseq: bid.bid.id.gseq,
            oseq: bid.bid.id.oseq,
            provider: bid.bid.id.provider
          }
        ],
        manifest: deploymentResponse.data.manifest
      });
      expect(leaseResponse.data).toMatchObject({
        deployment: expect.objectContaining({
          id: expect.objectContaining({
            dseq: deploymentResponse.data.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            id: expect.objectContaining({
              dseq: deploymentResponse.data.dseq,
              gseq: bid.bid.id.gseq,
              oseq: bid.bid.id.oseq,
              provider: bid.bid.id.provider
            }),
            state: expect.any(String),
            price: expect.objectContaining({
              denom: "uact",
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
                denom: "uact",
                amount: expect.any(String)
              })
            ])
          })
        })
      });

      // Step 5: Deposit additional funds into deployment escrow account
      const depositResponse = await api.v1.depositDeployment({
        data: {
          dseq: deploymentResponse.data.dseq,
          deposit: 0.5
        }
      });
      expect(depositResponse.data).toMatchObject({
        escrow_account: expect.objectContaining({
          id: expect.any(Object),
          state: expect.objectContaining({
            funds: expect.arrayContaining([
              expect.objectContaining({
                denom: "uact",
                amount: expect.any(String)
              })
            ])
          })
        })
      });

      // Step 6: Update deployment with new SDL configuration using appropriate authentication
      const updatedDeployment = await api.v1.updateDeployment({
        dseq: deploymentResponse.data.dseq,
        data: {
          sdl: fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl-update.yml"), "utf8")
        }
      });
      expect(updatedDeployment.data).toMatchObject({
        deployment: expect.objectContaining({
          id: expect.objectContaining({
            dseq: deploymentResponse.data.dseq
          })
        })
      });

      // Step 7: Retrieve complete deployment details including leases and escrow
      const deploymentDetails = await api.v1.getDeployment({ dseq: deploymentResponse.data.dseq });
      expect(deploymentDetails.data).toMatchObject({
        deployment: expect.objectContaining({
          id: expect.objectContaining({
            dseq: deploymentResponse.data.dseq
          }),
          state: expect.any(String)
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            id: expect.objectContaining({
              dseq: deploymentResponse.data.dseq
            })
          })
        ])
      });

      // Step 8: Close deployment and terminate all associated leases
      const closedDeploymentResponse = await api.v1.closeDeployment({
        dseq: deploymentResponse.data.dseq
      });
      expect(closedDeploymentResponse.data.success).toBe(true);
    } catch (e) {
      // Final step: Close deployment in case of error to release escrow funds and cleanup
      await api.v1.closeDeployment({
        dseq: deploymentResponse.data.dseq
      });
      throw e;
    }
  });

  it("can create deployment with sealed secrets", { timeout: 2 * 60 * 1000 }, async () => {
    const { api } = await setup();
    const sdl = `
      version: "2.0"
      services:
        web:
          image: ghcr.io/akash-network/hello-akash-world:2.1.0
          env:
            - TEST_ENV=ac-secret://TEST_SECRET
            - TEST_ANOTHER_ENV=ac-secret://TEST_ANOTHER_SECRET
            - TEST_VAR=test me
          expose:
            - port: 3000
              as: 80
              to:
                - global: true
      profiles:
        compute:
          web:
            resources:
              cpu:
                units: 0.5
              memory:
                size: 512Mi
              storage:
                - size: 512Mi
        placement:
          dcloud:
            pricing:
              web:
                denom: uact
                amount: 1000
      deployment:
        web:
          dcloud:
            profile: web
            count: 1
    `;

    const { data: sdlSecretsContext } = await api.v1.getSDLSecretsContext();
    const pubKey = await crypto.subtle.importKey("jwk", sdlSecretsContext.jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const sealedSecrets = await new CompactEncrypt(
      new TextEncoder().encode(
        JSON.stringify({
          TEST_SECRET: "secret-value",
          TEST_ANOTHER_SECRET: "another secret value"
        })
      )
    )
      .setProtectedHeader({
        alg: "RSA-OAEP-256",
        enc: "A256GCM",
        kid: sdlSecretsContext.kid,
        sub: sdlSecretsContext.sub,
        exp: Math.floor(Date.now() / 1000) + 5 * 60
      })
      .encrypt(pubKey);

    console.log("Creating deployment...");
    const deploymentResponse = await api.v1.createDeployment({
      data: {
        sdl,
        sealedSecrets
      } as any // sealedSecrets currently is a hidden field in the API spec
    });

    expect(deploymentResponse.data).toMatchObject({
      dseq: expect.any(String),
      // until manifest is not ignored by lease create API, it returns secrets as is
      manifest: expect.stringMatching(/(secret-value|another secret value)/)
    });

    try {
      const bid = await waitForBids(api, deploymentResponse.data.dseq);
      const leaseResponse = await api.v1.createLease({
        leases: [
          {
            dseq: bid.bid.id.dseq,
            gseq: bid.bid.id.gseq,
            oseq: bid.bid.id.oseq,
            provider: bid.bid.id.provider
          }
        ],
        manifest: deploymentResponse.data.manifest
      });

      expect(leaseResponse.data).toMatchObject({
        deployment: expect.objectContaining({
          id: expect.objectContaining({
            dseq: deploymentResponse.data.dseq
          }),
          state: "active"
        }),
        leases: expect.arrayContaining([
          expect.objectContaining({
            id: expect.objectContaining({
              dseq: deploymentResponse.data.dseq,
              gseq: bid.bid.id.gseq,
              oseq: bid.bid.id.oseq,
              provider: bid.bid.id.provider
            }),
            state: expect.any(String),
            price: expect.objectContaining({
              denom: "uact",
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
                denom: "uact",
                amount: expect.any(String)
              })
            ])
          })
        })
      });

      const closedDeploymentResponse = await api.v1.closeDeployment({
        dseq: deploymentResponse.data.dseq
      });
      expect(closedDeploymentResponse.data.success).toBe(true);
    } catch (e) {
      // Final step: Close deployment in case of error to release escrow funds and cleanup
      await api.v1.closeDeployment({
        dseq: deploymentResponse.data.dseq
      });
      throw e;
    }
  });

  async function setup() {
    const apiKey = z.string().parse(process.env.CONSOLE_API_E2E_API_KEY);
    const baseUrl = z.string().url().parse(process.env.TEST_API_BASE_URL);

    const api = createApi<paths, typeof operations>(operations, {
      baseUrl,
      fetch: fetch,
      defaultHeaders: {
        "X-Api-Key": apiKey
      }
    });

    return {
      api
    };
  }

  async function waitForBids(api: Awaited<ReturnType<typeof setup>>["api"], dseq: string) {
    return retry(
      handleWhenResult(res => !res),
      { maxAttempts: 10, backoff: new ConstantBackoff(6_000) }
    ).execute(async () => {
      const { data } = await api.v1.listBids({ dseq });

      return data[0];
    });
  }
});
