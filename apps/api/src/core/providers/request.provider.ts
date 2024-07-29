import { container, inject } from "tsyringe";

import { RequestStorageInterceptor } from "@src/core/services/request-storage/request-storage.interceptor";

const REQUEST = "REQUEST";

container.register(REQUEST, {
  useFactory: c => {
    return c.resolve(RequestStorageInterceptor).context;
  }
});

export const Request = () => inject(REQUEST);
