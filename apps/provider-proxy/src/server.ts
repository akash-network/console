import "./setupOpenTelemetry";

import { startAppServer } from "./app";

const { PORT = 3040 } = process.env;

startAppServer(Number(PORT)).then(server => {
  server.container.httpLogger?.info(`Http server listening on port ${PORT}`);
});
