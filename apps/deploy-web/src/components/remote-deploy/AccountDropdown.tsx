import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@akashnetwork/ui/components";
import { CoinsSwap, LogOut, User } from "iconoir-react";
import { useAtom } from "jotai";
import { ChevronDown } from "lucide-react";

import { tokens } from "@src/store/remoteDeployStore";
import type { BitProfile, GitHubProfile, GitLabProfile } from "@src/types/remoteProfile";

const AccountDropDown = ({
  userProfile,
  userProfileBit,
  userProfileGitLab
}: {
  userProfile?: GitHubProfile;
  userProfileBit?: BitProfile;
  userProfileGitLab?: GitLabProfile;
}) => {
  const [token, setToken] = useAtom(tokens);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant={"outline"} className="flex h-auto items-center gap-5 bg-popover py-1">
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src={userProfile?.avatar_url || userProfileBit?.links?.avatar?.href || userProfileGitLab?.avatar_url} />
              <AvatarFallback>
                <User />
              </AvatarFallback>
            </Avatar>
            <p className="hidden md:block">{userProfile?.login || userProfileBit?.username || userProfileGitLab?.name}</p>
          </div>
          <ChevronDown size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="md:hidden">{userProfile?.login || userProfileBit?.username || userProfileGitLab?.name}</DropdownMenuLabel>
        <DropdownMenuSeparator className="md:hidden" />
        <DropdownMenuItem
          onClick={() => {
            setToken({
              accessToken: null,
              refreshToken: null,
              type: "github",
              alreadyLoggedIn: token?.alreadyLoggedIn?.includes(token.type)
                ? token.alreadyLoggedIn
                : token?.alreadyLoggedIn && token?.alreadyLoggedIn?.length > 0
                  ? [...token.alreadyLoggedIn, token.type]
                  : [token.type]
            });
          }}
          className="flex cursor-pointer items-center gap-2"
        >
          <CoinsSwap className="text-sm" /> Switch Git Provider
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            setToken({
              accessToken: null,
              refreshToken: null,
              type: "github",
              alreadyLoggedIn: []
            })
          }
          className="flex cursor-pointer items-center gap-2"
        >
          <LogOut className="text-sm" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountDropDown;
