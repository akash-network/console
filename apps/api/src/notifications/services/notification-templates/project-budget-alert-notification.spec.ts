import { describe, expect, it } from "vitest";

import { projectBudgetAlertNotification, type ProjectBudgetAlertVars } from "./project-budget-alert-notification";

import { createUser } from "@test/seeders/user.seeder";

describe(projectBudgetAlertNotification.name, () => {
  it("tells how much of the monthly budget the project committed and links to the project", () => {
    const user = createUser({ id: "user-123", email: "user@example.com" });

    const result = projectBudgetAlertNotification(user, createVars({ committedUsd: 85.5, budgetUsd: 100 }));

    expect(result.notificationId).toBe("projectBudgetAlert.project-1.2026-10-01.user-123");
    expect(result.payload.summary).toBe("Project staging has committed 85% of its monthly budget");
    expect(result.payload.description).toBe(
      "Deposits committed for <strong>staging</strong> this month total <strong>$85.50</strong> of its <strong>$100.00</strong> monthly budget. " +
        "New deployments in this project are refused once a deposit would go past the budget. Its running deployments keep being topped up. " +
        "An owner or admin can change the budget."
    );
    expect(result.payload.actions).toEqual([{ label: "View project", url: "https://console.akash.network/projects/project-1" }]);
    expect(result.user).toEqual({ id: "user-123", email: "user@example.com" });
  });

  it("names the deposit that was not signed and says running deployments stop being topped up when that was chosen", () => {
    const user = createUser({ id: "user-123" });

    const result = projectBudgetAlertNotification(user, createVars({ committedUsd: 40, budgetUsd: 100, refusedUsd: 70, stopTopUps: true }));

    expect(result.payload.summary).toBe("Project staging has committed 40% of its monthly budget");
    expect(result.payload.description).toContain(
      "monthly budget. A deposit of <strong>$70.00</strong> was not signed because it would have gone past the budget. New deployments"
    );
    expect(result.payload.description).toContain("Top-ups of its running deployments stop at the budget too.");
    expect(result.payload.description).not.toContain("keep being topped up");
  });

  it("escapes the project name in the markup and keeps it plain in the summary, which the email layout escapes", () => {
    const user = createUser({ id: "user-123" });
    const projectName = `R&D <script>alert("x")</script> <a href="https://example.com">link</a>`;

    const result = projectBudgetAlertNotification(user, createVars({ projectName }));

    expect(result.payload.description).toContain(
      "<strong>R&amp;D &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &lt;a href=&quot;https://example.com&quot;&gt;link&lt;/a&gt;</strong>"
    );
    expect(result.payload.description).not.toContain("<script>");
    expect(result.payload.description).not.toContain('<a href="https://example.com">');
    expect(result.payload.summary).toBe(`Project ${projectName} has committed 80% of its monthly budget`);
  });

  function createVars(overrides: Partial<ProjectBudgetAlertVars>): ProjectBudgetAlertVars {
    return {
      projectId: "project-1",
      projectName: "staging",
      period: "2026-10-01",
      committedUsd: 80,
      budgetUsd: 100,
      refusedUsd: 0,
      stopTopUps: false,
      projectUrl: "https://console.akash.network/projects/project-1",
      ...overrides
    };
  }
});
