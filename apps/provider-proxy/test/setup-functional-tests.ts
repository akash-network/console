import { startServer, stopServer } from "./setup/apiClient";

beforeAll(async () => {
  await startServer();
});

afterAll(() => {
  stopServer();
});
