import { faker } from "@faker-js/faker";

import type { UserOutput } from "@src/queries/useAnonymousUserQuery";
import type { CustomUserProfile } from "@src/types/user";
import { plans } from "@src/utils/plans";

export const buildUser = (overrides: Partial<CustomUserProfile> = {}): CustomUserProfile => {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    email: faker.internet.email(),
    emailVerified: faker.datatype.boolean(),
    name: faker.person.fullName(),
    picture: faker.image.avatar(),
    username: faker.internet.username(),
    subscribedToNewsletter: faker.datatype.boolean(),
    bio: faker.lorem.sentence(),
    youtubeUsername: faker.internet.username(),
    twitterUsername: faker.internet.username(),
    githubUsername: faker.internet.username(),
    planCode: "COMMUNITY",
    plan: plans.find(plan => plan.code === "COMMUNITY"),
    ...overrides
  };
};

export const buildAnonymousUser = (overrides: Partial<UserOutput> = {}): UserOutput => {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    email: faker.internet.email(),
    emailVerified: faker.datatype.boolean(),
    subscribedToNewsletter: faker.datatype.boolean(),
    bio: faker.lorem.sentence(),
    youtubeUsername: faker.internet.username(),
    twitterUsername: faker.internet.username(),
    githubUsername: faker.internet.username(),
    ...overrides
  };
};
