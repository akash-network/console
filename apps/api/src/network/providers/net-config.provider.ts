import { netConfig } from "@akashnetwork/net";
import { NetConfig } from "@akashnetwork/net/src/NetConfig/NetConfig";
import { container } from "tsyringe";

container.register(NetConfig, {
  useValue: netConfig
});
