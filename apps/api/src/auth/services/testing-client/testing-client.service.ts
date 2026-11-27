import { createHash, timingSafeEqual } from "crypto";
import { singleton } from "tsyringe";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";

/** The e2e suite ends its browser's user agent with `UIT/<token>.`, and only it knows the token. */
const TESTING_CLIENT_MARKER = / UIT\/(\S+)\.$/;

@singleton()
export class TestingClientService {
  constructor(private readonly config: AuthConfigService) {}

  isTestingClient(userAgent: string | undefined): boolean {
    const expectedToken = this.config.get("E2E_TESTING_CLIENT_TOKEN");
    const presentedToken = userAgent?.match(TESTING_CLIENT_MARKER)?.[1];
    if (!expectedToken || !presentedToken) return false;

    return timingSafeEqual(sha256(presentedToken), sha256(expectedToken));
  }
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
