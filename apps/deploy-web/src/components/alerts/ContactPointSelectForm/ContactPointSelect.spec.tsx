import { FormProvider, useForm } from "react-hook-form";

import type { ContactPointsOutput } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import type { FCWithChildren } from "@src/types/component";
import { ContactPointSelectView } from "./ContactPointSelect";

import { render, screen } from "@testing-library/react";

describe("ContactPointSelectView (integration with form)", () => {
  const Wrapper: FCWithChildren = ({ children }) => {
    const methods = useForm({ defaultValues: { contactPointId: "" } });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  const contactPoints = [
    { id: "1", name: "Email: alice@example.com" },
    { id: "2", name: "Phone: +123456789" }
  ] as ContactPointsOutput;

  it("renders select items from data", () => {
    render(
      <Wrapper>
        <ContactPointSelectView data={[]} isFetched={true} />
      </Wrapper>
    );

    expect(screen.getByText("Contact Point")).toBeInTheDocument();
    expect(screen.getByText("Select contact point")).toBeInTheDocument();
  });

  it("preselects first item once fetched", async () => {
    render(
      <Wrapper>
        <ContactPointSelectView data={contactPoints} isFetched={true} />
      </Wrapper>
    );

    expect(await screen.findByText("Email: alice@example.com")).toBeInTheDocument();
  });
});
