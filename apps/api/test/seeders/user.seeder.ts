import { faker } from "@faker-js/faker";

import { UserOutput } from "@src/user/repositories";

export class UserSeeder {
  static create({
    id = faker.string.uuid(),
    userId = faker.string.uuid(),
    username = faker.word.noun(),
    email = faker.internet.email(),
    emailVerified = faker.datatype.boolean(),
    stripeCustomerId = faker.string.uuid(),
    bio = faker.lorem.paragraph(),
    subscribedToNewsletter = faker.datatype.boolean(),
    youtubeUsername = faker.word.noun(),
    twitterUsername = faker.word.noun(),
    githubUsername = faker.word.noun(),
    lastActiveAt = faker.date.recent(),
    lastIp = faker.internet.ip(),
    lastUserAgent = faker.internet.userAgent(),
    lastFingerprint = faker.word.noun(),
    createdAt = faker.date.recent(),
  }: Partial<UserOutput> = {}): UserOutput {
    return {
      id,
      userId,
      username,
      email,
      emailVerified,
      stripeCustomerId,
      bio,
      subscribedToNewsletter,
      youtubeUsername,
      twitterUsername,
      githubUsername,
      lastActiveAt,
      lastIp,
      lastUserAgent,
      lastFingerprint,
      createdAt,
    };
  }
}
