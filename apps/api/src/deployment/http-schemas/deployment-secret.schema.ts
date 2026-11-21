import { z } from "@hono/zod-openapi";

import { DseqSchema } from "@src/utils/schema";

export const ListDeploymentSecretsParamsSchema = z.object({
  dseq: DseqSchema.describe("Deployment sequence number")
});

const EnvSecretUsageSchema = z
  .object({
    service: z.string().openapi({ description: "Name of the service, as the deployment's SDL declares it." }),
    env: z.string().openapi({ description: "Environment variable of the service whose value is the secret." })
  })
  .openapi({ description: "The secret is the value of one of the service's environment variables." });

const CredentialSecretUsageSchema = z
  .object({
    service: z.string().openapi({ description: "Name of the service, as the deployment's SDL declares it." }),
    credential: z.enum(["username", "password"]).openapi({ description: "Half of the service's private registry credentials the secret fills." })
  })
  .openapi({ description: "The secret is the username or password the service pulls its image from a private registry with." });

const DeploymentSecretSchema = z.object({
  name: z.string().openapi({
    description:
      "Name the secret is stored under, as an `ac-secret://NAME` reference in the deployment's SDL spells it. Includes names the console chose itself when it sealed a value for you, such as `s0_e1`."
  }),
  usedBy: z.array(z.union([EnvSecretUsageSchema, CredentialSecretUsageSchema])).openapi({
    description:
      "Every place the SDL uses the secret, in the order the SDL lists its services, environment variables before registry credentials within a service. An entry carries `env` for an environment variable and `credential` for a registry credential."
  })
});

export const ListDeploymentSecretsResponseSchema = z.object({
  data: z.object({
    secrets: z.array(DeploymentSecretSchema).openapi({
      description: "Each secret the deployment's SDL references, listed once and sorted by name. Values are never returned."
    })
  })
});

export type ListDeploymentSecretsResponse = z.infer<typeof ListDeploymentSecretsResponseSchema>;
export type DeploymentSecretUsage = ListDeploymentSecretsResponse["data"]["secrets"][number]["usedBy"][number];
