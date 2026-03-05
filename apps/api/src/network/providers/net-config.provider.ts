import { NetConfig, netConfig } from "@akashnetwork/net";
import { container } from "tsyringe";

container.register(NetConfig, {
  useValue: netConfig
});
