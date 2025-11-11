import { UserSetting } from "@akashnetwork/database/dbSchemas/user";
import type { Transaction } from "sequelize";

export async function checkUsernameAvailable(username: string, dbTransaction?: Transaction): Promise<boolean> {
  const existingUser = await UserSetting.findOne({ where: { username: username }, transaction: dbTransaction });
  return !existingUser;
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
