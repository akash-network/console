import { describe, expect, it, vi } from "vitest";

import { AuthLayoutV2, DEPENDENCIES } from "./AuthLayoutV2";

import { render } from "@testing-library/react";

describe(AuthLayoutV2.name, () => {
  it("renders the Globe with REGION_MARKERS", () => {
    const GlobeMock = vi.fn<(props: React.ComponentProps<typeof DEPENDENCIES.Globe>) => React.ReactElement>(() => <div data-testid="globe-mock" />);
    render(
      <AuthLayoutV2 dependencies={{ ...DEPENDENCIES, Globe: GlobeMock }}>
        <div>Children</div>
      </AuthLayoutV2>
    );
    expect(GlobeMock).toHaveBeenCalled();
    expect(GlobeMock.mock.calls[0][0]).toMatchObject({
      markers: expect.arrayContaining([expect.objectContaining({ label: "us-east-1" })])
    });
  });
});
