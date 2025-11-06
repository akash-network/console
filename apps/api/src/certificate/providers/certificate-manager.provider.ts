import { CertificateManager, certificateManager } from "@akashnetwork/chain-sdk";
import { container } from "tsyringe";

container.register(CertificateManager, {
  useValue: certificateManager
});

export { CertificateManager };
