import { faker } from "@faker-js/faker";

import type { ProjectSpend, ProjectSpendReport, SpendAmounts } from "@src/types/project-budget";

export const buildSpendAmounts = (overrides: Partial<SpendAmounts> = {}): SpendAmounts => ({
  committedUsd: 0,
  consumedUsd: 0,
  estimatedConsumedUsd: 0,
  ...overrides
});

export const buildProjectSpend = (overrides: Partial<ProjectSpend> = {}): ProjectSpend => ({
  projectId: faker.string.uuid(),
  name: faker.word.noun(),
  isDefault: false,
  isDeleted: false,
  ...buildSpendAmounts(),
  ...overrides
});

export const buildProjectSpendReport = (overrides: Partial<ProjectSpendReport> = {}): ProjectSpendReport => ({
  startDate: "2026-03-01",
  endDate: "2026-03-30",
  isEstimated: false,
  projects: [],
  unassigned: buildSpendAmounts(),
  total: buildSpendAmounts(),
  ...overrides
});
