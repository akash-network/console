import { AxiosError } from "axios";

import { DEPENDENCIES, RemoteApiError } from "./RemoteApiError";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(RemoteApiError.name, () => {
  it("renders standard error message for non-HTTP errors", () => {
    const { getByText } = setup({ error: new Error("Test error") });
    expect(getByText(/unexpected error/i)).toBeInTheDocument();
  });

  it("renders error message from HTTP error response", () => {
    const error = new AxiosError("Test error", "400", undefined, undefined, {
      status: 400,
      statusText: "Test error",
      data: { message: "Error message from API" },
      headers: {},
      config: {} as any
    });
    const { getByText } = setup({ error });
    expect(getByText(/Error message from API/i)).toBeInTheDocument();
  });

  it("does not render anything when error is null or undefined", () => {
    const result = setup({ error: null });
    expect(result.container).toBeEmptyDOMElement();
    const result2 = setup({ error: undefined });
    expect(result2.container).toBeEmptyDOMElement();
  });

  function setup(input?: { error?: Error | null }) {
    return render(<RemoteApiError error={input?.error ?? null} dependencies={MockComponents(DEPENDENCIES)} />);
  }
});
