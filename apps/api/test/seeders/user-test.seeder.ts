import { TEST_CONSTANTS } from "./stripe-test-data.seeder";
import { UserSeeder } from "./user.seeder";

export function createTestUser(overrides: Partial<{ id: string; stripeCustomerId: string | null }> = {}) {
  return UserSeeder.create({
    id: TEST_CONSTANTS.USER_ID,
    stripeCustomerId: TEST_CONSTANTS.CUSTOMER_ID,
    ...overrides
  });
}
