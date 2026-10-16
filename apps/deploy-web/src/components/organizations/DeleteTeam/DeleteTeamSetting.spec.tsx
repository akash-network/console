import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./DeleteTeamSetting";
import { DeleteTeamSetting } from "./DeleteTeamSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const TEAM = { id: "org-2", name: "Acme Corp" };

describe(DeleteTeamSetting.name, () => {
  it("warns that deleting the team is permanent and forfeits its credits", () => {
    setup();

    expect(screen.getByText("Permanently delete Acme Corp for everyone in it, forfeiting its remaining credits. This can't be undone.")).toBeInTheDocument();
  });

  it("opens the deletion dialog for the team and closes it again", async () => {
    const { user, DeleteTeamDialog } = setup();

    expect(DeleteTeamDialog).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete team" }));

    expect(DeleteTeamDialog.mock.lastCall?.[0]).toEqual(expect.objectContaining({ organization: TEAM }));

    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
  });

  function setup() {
    const DeleteTeamDialog = vi.fn<typeof DEPENDENCIES.DeleteTeamDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        Close dialog
      </button>
    ));

    render(<DeleteTeamSetting organization={TEAM} dependencies={{ DeleteTeamDialog }} />);

    return { user: userEvent.setup(), DeleteTeamDialog };
  }
});
