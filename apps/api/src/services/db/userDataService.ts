import { UserAddressName, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import pick from "lodash/pick";
import { Transaction } from "sequelize";

import { LoggerService } from "@src/core";

const logger = new LoggerService({ context: "UserDataService" });

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export async function checkUsernameAvailable(username: string, dbTransaction?: Transaction): Promise<boolean> {
  const existingUser = await UserSetting.findOne({ where: { username: username }, transaction: dbTransaction });
  return !existingUser;
}

async function generateUsername(wantedUsername: string, dbTransaction?: Transaction): Promise<string> {
  let baseUsername = wantedUsername.replace(/[^a-zA-Z0-9_-]/gi, "");

  if (baseUsername.length < 3) {
    baseUsername = "anonymous";
  } else if (baseUsername.length > 40) {
    baseUsername = baseUsername.substring(0, 40);
  }

  let username = baseUsername;

  while (!(await checkUsernameAvailable(username, dbTransaction))) {
    username = baseUsername + randomIntFromInterval(1000, 9999);
  }

  return username;
}

export async function updateSettings(
  userId: string,
  username: string,
  subscribedToNewsletter: boolean,
  bio: string,
  youtubeUsername: string,
  twitterUsername: string,
  githubUsername: string
) {
  const settings = await UserSetting.findOne({ where: { userId: userId } });

  if (!settings) throw new Error("User settings not found: " + userId);

  if (username !== settings.username) {
    const isAvailable = await checkUsernameAvailable(username);
    if (!isAvailable) throw new Error(`Username not available: ${username} (${userId})`);

    settings.username = username;
  }

  settings.subscribedToNewsletter = subscribedToNewsletter;
  settings.bio = bio;
  settings.youtubeUsername = youtubeUsername;
  settings.twitterUsername = twitterUsername;
  settings.githubUsername = githubUsername;

  await settings.save();
}

type UserInput = {
  anonymousUserId?: string;
  userId: string;
  wantedUsername: string;
  email: string;
  emailVerified: boolean;
  subscribedToNewsletter: boolean;
};

export async function getSettingsOrInit({ anonymousUserId, userId, wantedUsername, email, emailVerified, subscribedToNewsletter }: UserInput) {
  let userSettings: UserSetting;
  let isAnonymous = false;

  if (anonymousUserId) {
    try {
      const updateResult = await UserSetting.update(
        {
          userId,
          username: await generateUsername(wantedUsername),
          email: email,
          emailVerified: emailVerified,
          stripeCustomerId: null,
          subscribedToNewsletter: subscribedToNewsletter
        },
        { where: { id: anonymousUserId, userId: null }, returning: ["*"] }
      );

      userSettings = updateResult[1][0];
      isAnonymous = !!userSettings;

      if (isAnonymous) {
        logger.info({ event: "ANONYMOUS_USER_REGISTERED", id: anonymousUserId, userId });
      }
    } catch (error) {
      if (error.name !== "SequelizeUniqueConstraintError") {
        throw error;
      }

      logger.info({ event: "ANONYMOUS_USER_ALREADY_REGISTERED", id: anonymousUserId, userId });
    }
  }

  if (!isAnonymous) {
    userSettings = await UserSetting.findOne({ where: { userId: userId } });
    logger.debug({ event: "USER_RETRIEVED", id: anonymousUserId, userId });
  }

  if (!userSettings) {
    userSettings = await UserSetting.create({
      userId: userId,
      username: await generateUsername(wantedUsername),
      email: email,
      emailVerified: emailVerified,
      stripeCustomerId: null,
      subscribedToNewsletter: subscribedToNewsletter
    });
    logger.info({ event: "USER_REGISTERED", userId });
  }

  if (userSettings.email !== email || userSettings.emailVerified !== emailVerified) {
    userSettings.email = email;
    userSettings.emailVerified = emailVerified;
    await userSettings.save();
  }

  return pick(userSettings, [
    "id",
    "userId",
    "username",
    "email",
    "emailVerified",
    "stripeCustomerId",
    "bio",
    "subscribedToNewsletter",
    "youtubeUsername",
    "twitterUsername",
    "githubUsername"
  ]);
}

export async function getAddressNames(userId: string) {
  const addressNames = await UserAddressName.findAll({
    where: {
      userId: userId
    }
  });

  return addressNames.reduce((obj, current) => ({ ...obj, [current.address]: current.name }), {});
}

export async function saveAddressName(userId: string, address: string, name: string) {
  let addressName = await UserAddressName.findOne({ where: { userId: userId, address: address } });

  if (!addressName) {
    addressName = UserAddressName.build({
      userId: userId,
      address: address
    });
  }

  addressName.name = name;

  await addressName.save();
}

export async function removeAddressName(userId: string, address: string) {
  await UserAddressName.destroy({ where: { userId: userId, address: address } });
}

export async function getUserByUsername(username: string) {
  const user = await UserSetting.findOne({ where: { username: username } });

  if (!user) return null;

  return {
    username: user.username,
    bio: user.bio
  };
}

export async function subscribeToNewsletter(userId: string) {
  await UserSetting.update(
    {
      subscribedToNewsletter: true
    },
    {
      where: {
        userId: userId
      }
    }
  );
}
