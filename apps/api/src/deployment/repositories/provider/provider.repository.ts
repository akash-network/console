import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { QueryTypes } from "sequelize";
import { singleton } from "tsyringe";

import { chainDb } from "@src/db/dbConnection";
import { AUDITOR, TRIAL_ATTRIBUTE, TRIAL_REGISTERED_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { TrialProviders } from "@src/types/provider";

@singleton()
export class ProviderRepository {
  async getTrialProviders(registered: boolean): Promise<TrialProviders> {
    const latestSnapshots = await chainDb.query<{
      owner: string;
      hostUri: string;
      availableCPU: number;
      availableGPU: number;
      availableMemory: number;
      availablePersistentStorage: number;
      availableEphemeralStorage: number;
      checkDate: Date;
    }>(
      `
          SELECT
            DISTINCT ON ("owner")
            p."hostUri",
            ps."owner",
            ps."availableCPU",
            ps."availableGPU",
            ps."availableMemory",
            ps."availablePersistentStorage",
            ps."availableEphemeralStorage",
            ps."checkDate"
          FROM "providerSnapshot" AS ps
          INNER JOIN "provider" AS p
            ON p."owner"=ps."owner"
          INNER JOIN "providerAttributeSignature" pas
            ON pas."provider"=ps."owner"
            AND pas."auditor"=:auditor
            AND pas."key"=:key
            AND pas."value"='true'
          ORDER BY ps."owner", ps."checkDate" DESC
        `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          auditor: AUDITOR,
          key: registered ? TRIAL_REGISTERED_ATTRIBUTE : TRIAL_ATTRIBUTE
        }
      }
    );

    const providers = latestSnapshots.map(snapshot => ({
      owner: snapshot.owner,
      hostUri: snapshot.hostUri,
      availableCPU: snapshot.availableCPU || 0,
      availableGPU: snapshot.availableGPU || 0,
      availableMemory: snapshot.availableMemory || 0,
      availablePersistentStorage: snapshot.availablePersistentStorage || 0,
      availableEphemeralStorage: snapshot.availableEphemeralStorage || 0
    }));

    const total = providers.reduce(
      (acc, provider) => ({
        availableCPU: acc.availableCPU + provider.availableCPU,
        availableGPU: acc.availableGPU + provider.availableGPU,
        availableMemory: acc.availableMemory + provider.availableMemory,
        availablePersistentStorage: acc.availablePersistentStorage + provider.availablePersistentStorage,
        availableEphemeralStorage: acc.availableEphemeralStorage + provider.availableEphemeralStorage
      }),
      {
        availableCPU: 0,
        availableGPU: 0,
        availableMemory: 0,
        availablePersistentStorage: 0,
        availableEphemeralStorage: 0
      }
    );

    return {
      providers,
      total
    };
  }

  async getProvider(address: string): Promise<Provider> {
    return await Provider.findByPk(address);
  }
}
