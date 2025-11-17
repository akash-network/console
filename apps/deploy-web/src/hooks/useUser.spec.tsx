import type { UserHttpService } from "@akashnetwork/http-sdk";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { mock } from "jest-mock-extended";

import type * as useCustomUserModule from "@src/hooks/useCustomUser";
import { useIsRegisteredUser } from "./useUser";

import { buildUser } from "@tests/seeders/user";
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

  function setup({ customUser }: { customUser?: ReturnType<typeof buildUser> } = {}) {
    mock<typeof useCustomUserModule.useCustomUser>(() => ({
      user: customUser || buildUser(),
      isLoading: false,
      error: undefined,
      checkSession: mock()
    }));

    jest.clearAllMocks();
    jest.restoreAllMocks();

    const mockUserHttpService = mock<UserHttpService>({});

    return setupQuery(() => useIsRegisteredUser(), {
      services: {
        user: () => mockUserHttpService
      },
      wrapper: ({ children }) => (
        <CustomSnackbarProvider>
          <UserProvider user={customUser}>{children}</UserProvider>
        </CustomSnackbarProvider>
      )
    });
  }
});
