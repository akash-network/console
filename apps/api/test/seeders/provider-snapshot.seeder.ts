import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createProviderSnapshot = async (overrides: Partial<CreationAttributes<ProviderSnapshot>> = {}): Promise<ProviderSnapshot> => {
  return await ProviderSnapshot.create({
    owner: overrides.owner || faker.finance.ethereumAddress(),
    isLastOfDay: overrides.isLastOfDay ?? false,
    isLastSuccessOfDay: overrides.isLastSuccessOfDay ?? false,
    isOnline: overrides.isOnline ?? true,
    checkDate: overrides.checkDate || new Date(),
    error: overrides.error,
    deploymentCount: overrides.deploymentCount ?? faker.number.int({ min: 0, max: 100 }),
    leaseCount: overrides.leaseCount ?? faker.number.int({ min: 0, max: 50 }),
    activeCPU: overrides.activeCPU ?? faker.number.int({ min: 0, max: 1000 }),
    activeGPU: overrides.activeGPU ?? faker.number.int({ min: 0, max: 10 }),
    activeMemory: overrides.activeMemory ?? faker.number.int({ min: 0, max: 1000000000 }),
    activeEphemeralStorage: overrides.activeEphemeralStorage ?? faker.number.int({ min: 0, max: 1000000000 }),
    activePersistentStorage: overrides.activePersistentStorage ?? faker.number.int({ min: 0, max: 1000000000 }),
    pendingCPU: overrides.pendingCPU ?? faker.number.int({ min: 0, max: 1000 }),
    pendingGPU: overrides.pendingGPU ?? faker.number.int({ min: 0, max: 10 }),
    pendingMemory: overrides.pendingMemory ?? faker.number.int({ min: 0, max: 1000000000 }),
    pendingEphemeralStorage: overrides.pendingEphemeralStorage ?? faker.number.int({ min: 0, max: 1000000000 }),
    pendingPersistentStorage: overrides.pendingPersistentStorage ?? faker.number.int({ min: 0, max: 1000000000 }),
    availableCPU: overrides.availableCPU ?? faker.number.int({ min: 0, max: 1000 }),
    availableGPU: overrides.availableGPU ?? faker.number.int({ min: 0, max: 10 }),
    availableMemory: overrides.availableMemory ?? faker.number.int({ min: 0, max: 1000000000 }),
    availableEphemeralStorage: overrides.availableEphemeralStorage ?? faker.number.int({ min: 0, max: 1000000000 }),
    availablePersistentStorage: overrides.availablePersistentStorage ?? faker.number.int({ min: 0, max: 1000000000 })
  });
};
