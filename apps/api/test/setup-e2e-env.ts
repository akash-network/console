/**
 * Env setup for e2e tests.
 * Sets default TEST_API_BASE_URL if not provided.
 */

// Set default TEST_API_BASE_URL for e2e tests
if (!process.env.TEST_API_BASE_URL) {
  process.env.TEST_API_BASE_URL = "http://localhost:3080";
}
