import { setTags, setUser } from "@sentry/nextjs";

import type { CustomUserProfile } from "@src/types/user";

export class UserTracker {
  track(user?: CustomUserProfile | null) {
    if (user) {
      setUser({
        id: user.id
      });
    } else {
      setUser(null);
    }
    setTags({
      anonymous: user ? !user.userId : undefined,
      emailVerified: user?.emailVerified
    });
  }
}
