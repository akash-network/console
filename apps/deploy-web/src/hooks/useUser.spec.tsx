import type { UserHttpService } from "@akashnetwork/http-sdk";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { mock } from "jest-mock-extended";

import { AnonymousUserProvider } from "@src/context/AnonymousUserProvider/AnonymousUserProvider";
import type * as useCustomUserModule from "@src/hooks/useCustomUser";
import type * as useStoredAnonymousUserModule from "@src/hooks/useStoredAnonymousUser";
import { useIsRegisteredUser } from "./useUser";

import { buildAnonymousUser, buildUser } from "@tests/seeders/user";
import { setupQuery } from "@tests/unit/query-client";

describe("useIsRegisteredUser", () => {
  it("can visit when user has userId", () => {
    const { result } = setup({
      customUser: buildUser({ userId: "12345" })
    });

    expect(result.current).toEqual({
      isLoading: false,
      canVisit: true
    });
  });

  it("cannot visit when userId is falsy", () => {
    const { result } = setup({
      customUser: buildUser({ userId: "" })
    });

    expect(result.current).toEqual({
      isLoading: false,
      canVisit: false
    });
  });

  function setup({
    customUser,
    anonymousUser
  }: {
    customUser?: ReturnType<typeof buildUser>;
    anonymousUser?: ReturnType<typeof buildAnonymousUser>;
  } = {}) {
    mock<typeof useCustomUserModule.useCustomUser>(() => ({
      user: customUser || buildUser(),
      isLoading: false,
      error: undefined,
      checkSession: mock()
    }));

    mock<typeof useStoredAnonymousUserModule.useStoredAnonymousUser>(() => ({
      user: anonymousUser || buildAnonymousUser(),
      isLoading: false
    }));

    jest.clearAllMocks();
    jest.restoreAllMocks();

    const mockUserHttpService = mock<UserHttpService>({
      getOrCreateAnonymousUser: jest.fn().mockResolvedValue(anonymousUser)
    });

    return setupQuery(() => useIsRegisteredUser(), {
      services: {
        user: () => mockUserHttpService
      },
      wrapper: ({ children }) => (
        <CustomSnackbarProvider>
          <UserProvider user={customUser}>
            <AnonymousUserProvider>{children}</AnonymousUserProvider>
          </UserProvider>
        </CustomSnackbarProvider>
      )
    });
  }
});
