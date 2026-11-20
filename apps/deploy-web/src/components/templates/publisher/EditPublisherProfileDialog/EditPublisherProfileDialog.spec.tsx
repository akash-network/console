import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES, EditPublisherProfileDialogProps } from "./EditPublisherProfileDialog";
import { EditPublisherProfileDialog } from "./EditPublisherProfileDialog";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type UpdateMutation = ReturnType<typeof DEPENDENCIES.useUpdateTemplatePublisherMutation>;

const PROFILE: EditPublisherProfileDialogProps["profile"] = {
  name: "Lambda Garage",
  bio: "We build GPU inference stacks.",
  links: [{ url: "https://lambdagarage.dev/", label: null }]
};
const HOSTILE_MARKUP = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe(EditPublisherProfileDialog.name, () => {
  it("opens on the profile as it is saved", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Edit publisher profile" })).toBeInTheDocument();
    expect(screen.getByText(/Shown on the public page of Lambda Garage\./)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("We build GPU inference stacks.");
    expect(screen.getByRole("textbox", { name: "Link 1 address" })).toHaveValue("https://lambdagarage.dev/");
    expect(screen.getByRole("textbox", { name: "Link 1 label" })).toHaveValue("");
    expect(screen.getByLabelText("30 of 300 characters used")).toHaveTextContent("30 / 300");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("opens empty on a profile with no bio and no links", () => {
    setup({ profile: { name: "Lambda Garage", bio: null, links: [] } });

    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("");
    expect(screen.queryByRole("textbox", { name: "Link 1 address" })).not.toBeInTheDocument();
    expect(screen.getByText("0 / 3")).toBeInTheDocument();
  });

  it("saves the bio and the links, then closes", async () => {
    const { user, saveProfile, onClose } = setup({ profile: { name: "Lambda Garage", bio: null, links: [] } });

    await user.type(screen.getByRole("textbox", { name: "Bio" }), "  GPU stacks for small teams. ");
    await user.click(screen.getByRole("button", { name: "Add link" }));
    await user.type(screen.getByRole("textbox", { name: "Link 1 address" }), "https://lambdagarage.dev");
    await user.click(screen.getByRole("button", { name: "Add link" }));
    await user.type(screen.getByRole("textbox", { name: "Link 2 address" }), "https://github.com/lambda-garage");
    await user.type(screen.getByRole("textbox", { name: "Link 2 label" }), "GitHub");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(saveProfile).toHaveBeenCalledExactlyOnceWith({
      data: {
        bio: "GPU stacks for small teams.",
        links: [
          { url: "https://lambdagarage.dev", label: null },
          { url: "https://github.com/lambda-garage", label: "GitHub" }
        ]
      }
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clears the bio and every link", async () => {
    const { user, saveProfile } = setup({});

    await user.clear(screen.getByRole("textbox", { name: "Bio" }));
    await user.click(screen.getByRole("button", { name: "Remove link 1" }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(saveProfile).toHaveBeenCalledExactlyOnceWith({ data: { bio: null, links: [] } });
  });

  it("removes the link whose button was clicked and renumbers the rest", async () => {
    const { user } = setup({
      profile: {
        name: "Lambda Garage",
        bio: null,
        links: [
          { url: "https://one.example.org/", label: null },
          { url: "https://two.example.org/", label: "Two" }
        ]
      }
    });

    await user.click(screen.getByRole("button", { name: "Remove link 1" }));

    expect(screen.getByRole("textbox", { name: "Link 1 address" })).toHaveValue("https://two.example.org/");
    expect(screen.getByRole("textbox", { name: "Link 1 label" })).toHaveValue("Two");
    expect(screen.queryByRole("textbox", { name: "Link 2 address" })).not.toBeInTheDocument();
  });

  it("changes only the link being typed in", async () => {
    const { user } = setup({
      profile: {
        name: "Lambda Garage",
        bio: null,
        links: [
          { url: "https://one.dev/", label: null },
          { url: "https://two.dev/", label: null }
        ]
      }
    });

    await user.type(screen.getByRole("textbox", { name: "Link 2 label" }), "Two");

    expect(screen.getByRole("textbox", { name: "Link 1 label" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Link 1 address" })).toHaveValue("https://one.dev/");
    expect(screen.getByRole("textbox", { name: "Link 2 address" })).toHaveValue("https://two.dev/");
  });

  it("offers no fourth link", async () => {
    const { user } = setup({ profile: { name: "Lambda Garage", bio: null, links: [] } });

    await user.click(screen.getByRole("button", { name: "Add link" }));
    await user.click(screen.getByRole("button", { name: "Add link" }));
    expect(screen.getByRole("button", { name: "Add link" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add link" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Link 3 address" })).toBeInTheDocument();
  });

  it("says a bio is too long, counts it and keeps Save off", () => {
    const { saveProfile } = setup({});

    fireEvent.change(screen.getByRole("textbox", { name: "Bio" }), { target: { value: "a".repeat(301) } });

    expect(screen.getByText("The bio is longer than 300 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("301 of 300 characters used")).toHaveTextContent("301 / 300");
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();

    fireEvent.submit(screen.getByRole("textbox", { name: "Bio" }).closest("form") as HTMLFormElement);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("allows saving a bio of exactly the limit", () => {
    setup({});

    fireEvent.change(screen.getByRole("textbox", { name: "Bio" }), { target: { value: "a".repeat(300) } });

    expect(screen.queryByText("The bio is longer than 300 characters")).not.toBeInTheDocument();
    expect(screen.getByText("Plain text. Links and formatting are shown as written.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it("says what is wrong with a link under it and keeps Save off", async () => {
    const { user } = setup({ profile: { name: "Lambda Garage", bio: null, links: [{ url: "", label: null }] } });

    await user.type(screen.getByRole("textbox", { name: "Link 1 address" }), "http://lambdagarage.dev");

    const address = screen.getByRole("textbox", { name: "Link 1 address" });
    expect(screen.getByText("The link must start with https://")).toBeInTheDocument();
    expect(address).toHaveAttribute("aria-invalid", "true");
    expect(address).toHaveAccessibleDescription("The link must start with https://");
    expect(screen.getByRole("textbox", { name: "Link 1 label" })).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  });

  it("says a label is too long", () => {
    setup({});

    fireEvent.change(screen.getByRole("textbox", { name: "Link 1 label" }), { target: { value: "a".repeat(41) } });

    expect(screen.getByText("The label is longer than 40 characters")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Link 1 label" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Link 1 address" })).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  });

  it("describes nothing on a link that is fine", () => {
    setup({});

    expect(screen.getByRole("textbox", { name: "Link 1 address" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it.each([
    [
      new ApiError(400, { data: [{ path: ["data", "links", 0, "url"], message: "The link must name a public website" }] }, "400"),
      "The profile wasn't saved. Link 1: The link must name a public website."
    ],
    [new ApiError(401, null, "401"), "Your session ended. Sign in again to save the profile."],
    [new ApiError(403, null, "403"), "Only an owner or admin of the organization can change its publisher profile."],
    [new ApiError(404, null, "404"), "This organization has not published a template yet, so it has no publisher profile to change."],
    [new ApiError(500, null, "500"), "Couldn't save the profile. Try again in a moment."],
    [new TypeError("Failed to fetch"), "Couldn't save the profile. Try again in a moment."]
  ])("stays open and explains a save that failed with %s", async (saveError, message) => {
    const { user, onClose } = setup({ saveError });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("We build GPU inference stacks.");
  });

  it("drops the previous failure when saving again", async () => {
    const { user, saveProfile, onClose } = setup({ saveError: new ApiError(500, null, "500") });

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    saveProfile.mockImplementationOnce(() => new Promise(() => {}));
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks the form and cannot be dismissed while saving", async () => {
    const { user, saveProfile, onClose } = setup({ isSaving: true });

    expect(screen.getByRole("textbox", { name: "Bio" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Link 1 address" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    fireEvent.submit(screen.getByRole("textbox", { name: "Bio" }).closest("form") as HTMLFormElement);

    expect(onClose).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("closes without saving on Cancel and on Escape", async () => {
    const { user, saveProfile, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("renders markup in the publisher name and in a server issue as text", async () => {
    const { user } = setup({
      profile: { name: HOSTILE_MARKUP, bio: HOSTILE_MARKUP, links: [] },
      saveError: new ApiError(400, { data: [{ path: ["data", "bio"], message: HOSTILE_MARKUP }] }, "400")
    });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(HOSTILE_MARKUP);
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue(HOSTILE_MARKUP);
    expect(document.body.querySelector("img, script")).toBeNull();
  });

  function setup(input: { profile?: EditPublisherProfileDialogProps["profile"]; saveError?: unknown; isSaving?: boolean }) {
    const onClose = vi.fn();
    const saveProfile = vi.fn<UpdateMutation["mutateAsync"]>(async () => {
      if (input.saveError) throw input.saveError;
      return mock<Awaited<ReturnType<UpdateMutation["mutateAsync"]>>>();
    });
    const updateMutation = mock<UpdateMutation>({ mutateAsync: saveProfile, isPending: input.isSaving ?? false });

    render(
      <EditPublisherProfileDialog
        profile={input.profile ?? PROFILE}
        onClose={onClose}
        dependencies={{ useUpdateTemplatePublisherMutation: () => updateMutation }}
      />
    );

    return { user: userEvent.setup(), onClose, saveProfile };
  }
});
