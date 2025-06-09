import { FormProvider, useForm } from "react-hook-form";

import type { NotificationChannelsOutput } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import type { FCWithChildren } from "@src/types/component";
import { NotificationChannelSelectView } from "./NotificationChannelSelect";

import { render, screen } from "@testing-library/react";

describe("NotificationChannelSelectView (integration with form)", () => {
  const Wrapper: FCWithChildren = ({ children }) => {
    const methods = useForm({ defaultValues: { notificationChannelId: "" } });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  const notificationChannels = [
    { id: "1", name: "Email: alice@example.com" },
    { id: "2", name: "Phone: +123456789" }
  ] as NotificationChannelsOutput;

  it("renders select items from data", () => {
    render(
      <Wrapper>
        <NotificationChannelSelectView data={[]} isFetched={true} />
      </Wrapper>
    );

    expect(screen.getByText("Notification Channel")).toBeInTheDocument();
    expect(screen.getByText("Select notification channel")).toBeInTheDocument();
  });

  it("preselects first item once fetched", async () => {
    render(
      <Wrapper>
        <NotificationChannelSelectView data={notificationChannels} isFetched={true} />
      </Wrapper>
    );

    expect(await screen.findByText("Email: alice@example.com")).toBeInTheDocument();
  });
});
