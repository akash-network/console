import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { mock } from "jest-mock-extended";

import type { ProviderCredentials } from "./provider-proxy.service";
import { ProviderProxyService } from "./provider-proxy.service";

import { buildProvider } from "@tests/seeders";

describe(ProviderProxyService.name, () => {
  describe("sendManifest", () => {
    it("does nothing if provider is undefined", () => {
      const { service, httpClient } = setup();
      service.sendManifest(undefined, {}, { dseq: "1", chainNetwork: "akash" });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("sends manifest to provider", async () => {
      jest.useFakeTimers();

      const { service, httpClient } = setup();
      const provider = buildProvider();

      const response = {};
      const dseq = "1";
      httpClient.post.mockResolvedValue(response);
      const manifest = [
        {
          profiles: {
            compute: {
              web: {
                resources: {
                  cpu: {
                    units: {
                      val: "0.5"
                    }
                  }
                },
                memory: {
                  quantity: {
                    val: "512Mi"
                  }
                },
                storage: {
                  quantity: {
                    val: "512Mi"
                  }
                }
              }
            }
          }
        }
      ];
      const credentials: ProviderCredentials = { type: "mtls", value: { cert: "certPem", key: "keyPem" } };
      const promise = service.sendManifest(provider, manifest, { dseq, chainNetwork: "mainnet", credentials });

      const [result] = await Promise.all([promise, jest.runAllTimersAsync()]);

      expect(httpClient.post).toHaveBeenCalledWith(
        "/",
        {
          method: "PUT",
          url: `${provider.hostUri}/deployment/${dseq}/manifest`,
          providerAddress: provider.owner,
          network: "mainnet",
          auth: {
            type: "mtls",
            certPem: credentials.value?.cert,
            keyPem: credentials.value?.key
          },
          body: JSON.stringify([
            {
              profiles: {
                compute: {
                  web: {
                    resources: {
                      cpu: {
                        units: {
                          val: "0.5"
                        }
                      }
                    },
                    memory: {
                      size: {
                        val: "512Mi"
                      }
                    },
                    storage: {
                      size: {
                        val: "512Mi"
                      }
                    }
                  }
                }
              }
            }
          ])
        },
        { timeout: expect.any(Number) }
      );
      expect(result).toBe(response);

      jest.useRealTimers();
    });
  });

  function setup() {
    const httpClient = mock<HttpClient>();
    const service = new ProviderProxyService(httpClient, mock<LoggerService>());
    return { service, httpClient };
  }
});
