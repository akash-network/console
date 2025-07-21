import { CoreV1Api, KubeConfig, Log } from "@kubernetes/client-node";
import { container } from "tsyringe";

container.register(KubeConfig, {
  useFactory: () => {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    return kc;
  }
});

container.register(CoreV1Api, {
  useFactory: c => {
    const kc = c.resolve(KubeConfig);
    return kc.makeApiClient(CoreV1Api);
  }
});

container.register(Log, {
  useFactory: c => {
    const kc = c.resolve(KubeConfig);
    return new Log(kc);
  }
});
