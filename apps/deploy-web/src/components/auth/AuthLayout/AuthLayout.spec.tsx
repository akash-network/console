import { describe, expect, it, vi } from "vitest";

import { AuthLayout, DEPENDENCIES } from "./AuthLayout";

import { render } from "@testing-library/react";

describe(AuthLayout.name, () => {
  it("renders the Globe with REGION_MARKERS", () => {
    const GlobeMock = vi.fn<(props: React.ComponentProps<typeof DEPENDENCIES.Globe>) => React.ReactElement>(() => <div data-testid="globe-mock" />);
    render(
      <AuthLayout dependencies={{ ...DEPENDENCIES, Globe: GlobeMock }}>
        <div>Children</div>
      </AuthLayout>
    );
    expect(GlobeMock).toHaveBeenCalled();
    expect(GlobeMock.mock.calls[0][0]).toMatchObject({
      markers: expect.arrayContaining([expect.objectContaining({ label: "us-east-1" })])
    });
  });
});
