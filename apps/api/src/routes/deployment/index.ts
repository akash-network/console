import { bidsRouter } from "@src/bid/routes/bids/bids.router";
import { certificateRouter } from "@src/certificate/routes/certificate.router";
import { deploymentsRouter } from "@src/deployment/routes/deployments/deployments.router";
import { leasesRouter } from "@src/deployment/routes/leases/leases.router";

export default [deploymentsRouter, bidsRouter, certificateRouter, leasesRouter];
