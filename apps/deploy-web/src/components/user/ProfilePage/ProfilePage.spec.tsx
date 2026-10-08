import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CustomUserProfile } from "@src/types/user";
import { DEPENDENCIES, ProfilePage } from "./ProfilePage";

import { render, screen } from "@testing-library/react";
import { buildUser } from "@tests/seeders/user";
import { MockComponents } from "@tests/unit/mocks";

describe(ProfilePage.name, () => {
  it("shows the sign-in email under Account", () => {
    setup({ user: { email: "alice@example.com" } });

    expect(screen.getByRole("heading", { name: "Profile", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Account" })).toHaveTextContent("alice@example.com");
    expect(screen.getByRole("region", { name: "Email" })).toBeInTheDocument();
  });

  it("hands each setting the profile it edits", () => {
    const { user, UsernameSetting, ProductUpdatesSetting, DeleteAccountSection } = setup({ user: { username: "alice", email: "alice@example.com" } });

    expect(UsernameSetting.mock.lastCall?.[0]).toEqual(expect.objectContaining({ username: "alice" }));
    expect(ProductUpdatesSetting.mock.lastCall?.[0]).toEqual(expect.objectContaining({ user }));
    expect(DeleteAccountSection.mock.lastCall?.[0]).toEqual(expect.objectContaining({ email: "alice@example.com" }));
  });

  it("titles the page Profile and shows the layout loader while the profile loads", () => {
    const { Layout, NextSeo } = setup({ user: {}, isLoading: true });

    expect(NextSeo.mock.lastCall?.[0]).toEqual(expect.objectContaining({ title: "Profile" }));
    expect(Layout.mock.lastCall?.[0]).toEqual(expect.objectContaining({ isLoading: true, disableContainer: true }));
  });

  function setup(input: { user: Partial<CustomUserProfile>; isLoading?: boolean }) {
    const user = buildUser(input.user);
    const dependencies = MockComponents(DEPENDENCIES, {
      useCustomUser: () => mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({ isLoading: input.isLoading ?? false })
    });

    render(<ProfilePage user={user} dependencies={dependencies} />);

    return {
      user,
      Layout: vi.mocked(dependencies.Layout),
      NextSeo: vi.mocked(dependencies.NextSeo),
      UsernameSetting: vi.mocked(dependencies.UsernameSetting),
      ProductUpdatesSetting: vi.mocked(dependencies.ProductUpdatesSetting),
      DeleteAccountSection: vi.mocked(dependencies.DeleteAccountSection)
    };
  }
});
