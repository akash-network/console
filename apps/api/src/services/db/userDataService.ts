import { UserAddressName, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import { Transaction } from "sequelize";

import { getUserPlan } from "../external/stripeService";

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export async function checkUsernameAvailable(username: string, dbTransaction?: Transaction): Promise<boolean> {
  const existingUser = await UserSetting.findOne({ where: { username: username }, transaction: dbTransaction });
  return !existingUser;
}

async function generateUsername(wantedUsername: string, dbTransaction?: Transaction): Promise<string> {
  const sanitized = wantedUsername.replace(/[^a-zA-Z0-9_-]/gi, "");

  let baseUsername = sanitized;

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

export async function getSettingsOrInit(userId: string, wantedUsername: string, email: string, emailVerified: boolean, subscribedToNewsletter: boolean) {
  const [userSettings, created] = await UserSetting.findCreateFind({
    where: { userId: userId },
    defaults: {
      userId: userId,
      username: await generateUsername(wantedUsername),
      email: email,
      emailVerified: emailVerified,
      stripeCustomerId: null,
      subscribedToNewsletter: subscribedToNewsletter
    }
  });

  if (created) {
    console.log(`Created settings for user ${userId}`);
  } else if (userSettings.email !== email || userSettings.emailVerified !== emailVerified) {
    userSettings.email = email;
    userSettings.emailVerified = emailVerified;
    await userSettings.save();
  }

  const planCode = await getUserPlan(userSettings.stripeCustomerId);

  return {
    username: userSettings.username,
    email: userSettings.email,
    emailVerified: userSettings.emailVerified,
    stripeCustomerId: userSettings.stripeCustomerId,
    bio: userSettings.bio,
    subscribedToNewsletter: userSettings.subscribedToNewsletter,
    youtubeUsername: userSettings.youtubeUsername,
    twitterUsername: userSettings.twitterUsername,
    githubUsername: userSettings.githubUsername,
    planCode: planCode
  };
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
