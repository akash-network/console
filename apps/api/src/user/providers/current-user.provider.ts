import { container, inject } from "tsyringe";

import { RequestStorageInterceptor } from "@src/core/services/request-storage/request-storage.interceptor";
import { CURRENT_USER } from "@src/user/services/current-user/current-user.interceptor";

container.register(CURRENT_USER, {
  useFactory: c => {
    return c.resolve(RequestStorageInterceptor).context.get(CURRENT_USER);
  }
});

export const CurrentUser = () => inject(CURRENT_USER);
export type CurrentUser = {
  userId: string;
  isAnonymous: boolean;
};
