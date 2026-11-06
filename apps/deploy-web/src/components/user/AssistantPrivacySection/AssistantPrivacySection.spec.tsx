import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AssistantPrivacySection, DEPENDENCIES } from "./AssistantPrivacySection";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Privacy = NonNullable<ReturnType<typeof DEPENDENCIES.useAssistantPrivacyQuery>["data"]>;

const CONSENT: NonNullable<Privacy["consent"]> = {
  copyVersion: "2026-11-draft-1",
  processingAcceptedAt: "2026-11-04T12:00:00.000Z",
  reviewOptIn: true,
  updatedAt: "2026-11-04T12:00:00.000Z"
};

describe("AssistantPrivacySection", () => {
  it("renders nothing while the assistant is off or its privacy is loading", () => {
    const disabled = setup({ isEnabled: false });
    expect(disabled.container).toBeEmptyDOMElement();
    expect(disabled.useAssistantPrivacyQuery).toHaveBeenCalledWith({ enabled: false });

    expect(setup({ privacy: null }).container).toBeEmptyDOMElement();
  });

  it("shows the review opt-in with the date and version the user agreed to", () => {
    setup({});

    expect(screen.getByRole("region", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Improve Console with my assistant conversations" })).toBeChecked();
    expect(screen.getByText(/Agreed on Nov 4, 2026 · consent 2026-11-draft-1/)).toBeInTheDocument();
  });

  it("turns the review opt-in off under the version the user agreed to", async () => {
    const { updateConsent } = setup({});

    await userEvent.click(screen.getByRole("switch", { name: "Improve Console with my assistant conversations" }));

    expect(updateConsent).toHaveBeenCalledWith({ data: { copyVersion: "2026-11-draft-1", reviewOptIn: false } });
  });

  it("shows the choice being saved while the change is pending", () => {
    setup({ isUpdating: true, pendingReviewOptIn: false });

    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("says when the choice could not be saved", async () => {
    const { updateConsent, enqueueSnackbar } = setup({});
    updateConsent.mockRejectedValue(new Error("offline"));

    await userEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't save your choice" }) }), {
        variant: "error"
      })
    );
  });

  it("keeps the switch off and explains it before the user ever used the assistant", () => {
    setup({ privacy: { consent: null, storedConversationCount: 0 } });

    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByText("You haven't used the assistant yet. You can choose this the first time you open it.")).toBeInTheDocument();
  });

  it("deletes the saved conversations once the user confirms", async () => {
    const { confirm, deleteConversations, enqueueSnackbar } = setup({ privacy: { consent: CONSENT, storedConversationCount: 12 } });

    expect(screen.getByText("12 conversations. Deleting also removes them from the team's feedback reports.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete all" }));

    expect(confirm).toHaveBeenCalledWith({
      title: "Delete your saved conversations?",
      message: "This deletes 12 conversations and removes them from the team's feedback reports. It can't be undone."
    });
    expect(deleteConversations).toHaveBeenCalled();
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deleted 12 conversations" }) }), {
        variant: "success"
      })
    );
  });

  it("keeps the conversations when the user does not confirm", async () => {
    const { deleteConversations } = setup({ isConfirmed: false, privacy: { consent: CONSENT, storedConversationCount: 1 } });

    await userEvent.click(screen.getByRole("button", { name: "Delete all" }));

    expect(deleteConversations).not.toHaveBeenCalled();
  });

  it("names a single conversation and says when deleting failed", async () => {
    const { deleteConversations, enqueueSnackbar } = setup({ privacy: { consent: CONSENT, storedConversationCount: 1 } });
    deleteConversations.mockRejectedValue(new Error("offline"));

    expect(screen.getByText("1 conversation. Deleting also removes them from the team's feedback reports.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete all" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't delete your conversations" }) }),
        { variant: "error" }
      )
    );
  });

  it("names a single deleted conversation", async () => {
    const { deleteConversations, enqueueSnackbar } = setup({ privacy: { consent: CONSENT, storedConversationCount: 1 } });
    deleteConversations.mockResolvedValue({ data: { deletedCount: 1 } });

    await userEvent.click(screen.getByRole("button", { name: "Delete all" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Deleted 1 conversation" }) }),
        expect.anything()
      )
    );
  });

  it("has nothing to delete without saved conversations, or while deleting", () => {
    setup({ privacy: { consent: CONSENT, storedConversationCount: 0 } });
    expect(screen.getByRole("button", { name: "Delete all" })).toBeDisabled();
  });

  it("blocks a second delete while one runs", () => {
    setup({ isDeleting: true });
    expect(screen.getByRole("button", { name: "Delete all" })).toBeDisabled();
  });

  function setup(input: {
    isEnabled?: boolean;
    privacy?: Privacy | null;
    isConfirmed?: boolean;
    isUpdating?: boolean;
    pendingReviewOptIn?: boolean;
    isDeleting?: boolean;
  }) {
    const privacy = input.privacy === undefined ? { consent: CONSENT, storedConversationCount: 3 } : input.privacy;
    const updateConsent = vi.fn(async (_input: unknown) => ({ data: privacy! }));
    const deleteConversations = vi.fn(async () => ({ data: { deletedCount: privacy?.storedConversationCount ?? 0 } }));
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const useAssistantPrivacyQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAssistantPrivacyQuery>>(), { data: privacy ?? undefined })
    );
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useFlag: flag => flag === "user_feedback_loop" && (input.isEnabled ?? true),
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useAssistantPrivacyQuery,
      useUpdateAssistantConsentMutation: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUpdateAssistantConsentMutation>>(), {
          mutateAsync: updateConsent as never,
          isPending: !!input.isUpdating,
          variables: input.isUpdating ? { data: { copyVersion: CONSENT.copyVersion, reviewOptIn: !!input.pendingReviewOptIn } } : undefined
        }),
      useDeleteAssistantConversationsMutation: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeleteAssistantConversationsMutation>>(), {
          mutateAsync: deleteConversations as never,
          isPending: !!input.isDeleting
        })
    };

    const view = render(<AssistantPrivacySection dependencies={dependencies} />);

    return { ...view, updateConsent, deleteConversations, confirm, enqueueSnackbar, useAssistantPrivacyQuery };
  }
});
