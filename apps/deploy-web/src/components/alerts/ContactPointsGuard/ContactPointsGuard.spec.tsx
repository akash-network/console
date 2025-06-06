import { faker } from "@faker-js/faker";

import type { Props } from "./ContactPointsGuard";
import { ContactPointsGuardView } from "./ContactPointsGuard";

import { render, screen, waitFor } from "@testing-library/react";
import { buildContactPoint } from "@tests/seeders/contactPoint";

describe("ContactPointsGuardView", () => {
  it("renders loading blocker when not fetched", () => {
    setup();
    expect(screen.getByTestId("loading-blocker")).toBeInTheDocument();
  });

  it("renders message and link when no contact points", () => {
    setup({ isFetched: true });
    expect(screen.getByText("To start using alerting you need to add at least one contact point")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add contact point/i })).toBeInTheDocument();
  });

  it("renders children when contact points exist", async () => {
    const { childTestId } = setup({ data: [buildContactPoint()], isFetched: true });
    await waitFor(() => {
      expect(screen.getByTestId(childTestId)).toBeInTheDocument();
    });
  });

  function setup(providedProps: Partial<Props>) {
    const props = {
      isFetched: false,
      data: [],
      components: {
        AccountEmailContactPointCreator: () => null
      },
      ...providedProps
    };
    const childTestId = faker.string.uuid();
    const child = <div data-testid={childTestId} />;
    render(<ContactPointsGuardView {...props}>{child}</ContactPointsGuardView>);

    return {
      childTestId,
      child
    };
  }
});
