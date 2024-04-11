import { UrlService } from "@src/utils/urlUtils";
import { Metadata } from "next";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import { UserProfile } from "./UserProfile";
import { IUserSetting } from "@src/types/user";

interface IUserProfilePageProps {
  params: { username: string };
}

export async function generateMetadata({ params: { username } }: IUserProfilePageProps): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.userProfile(username)}`;

  return {
    title: username,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchUser(username: string): Promise<IUserSetting> {
  const response = await fetch(`${BASE_API_MAINNET_URL}/user/byUsername/${username}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching user data");
  }

  return await response.json();
}

export default async function TemplateDetailPage({ params: { username } }: IUserProfilePageProps) {
  const user = await fetchUser(username);

  return <UserProfile username={username} user={user} />;
}
