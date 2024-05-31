"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { SidebarRouteButton } from "./SidebarRouteButton";
import { WalletStatus } from "./WalletStatus";
import { Separator } from "../ui/separator";
import Spinner from "../shared/Spinner";
import { Avatar } from "../ui/avatar";
import { BookStack, MediaImageList, Settings, LogOut } from "iconoir-react";
import { buttonVariants } from "../ui/button";
import { cn } from "@src/utils/styleUtils";

// const useStyles = makeStyles()(theme => ({
//   list: {
//     padding: 0,
//     overflow: "hidden",
//     width: "100%",
//     border: "none"
//   },
//   listItem: {
//     padding: "4px 0"
//   }
// }));

type Props = {
  children?: ReactNode;
};

export const MobileSidebarUser: React.FunctionComponent<Props> = ({}) => {
  // const { classes } = useStyles();
  const { user, error, isLoading } = useCustomUser();

  return (
    // <ul role="list" className="-mx-2 space-y-1">
    //       {!!group.title && isNavOpen && (
    //         <li
    //         // sx={{ padding: ".5rem 0 .75rem", color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[800] }}
    //         >
    //           <span
    //             className="text-sm font-light"
    //             // variant="body2" sx={{ fontWeight: "light", fontSize: "1rem" }}
    //           >
    //             {group.title}
    //           </span>
    //         </li>
    //       )}

    //       {group.routes.map(route => {
    //         return <SidebarRouteButton key={route.title} route={route} isNavOpen={isNavOpen} />;
    //       })}
    //     </ul>

    <ul className="w-full overflow-hidden border-0 p-0">
      <Separator />

      <div className="flex items-center justify-center p-2">
        <WalletStatus />
      </div>

      <Separator />

      {isLoading ? (
        <div className="text-center">
          <Spinner size="small" />
        </div>
      ) : user ? (
        <div className="p-2">
          <SidebarRouteButton
            route={{
              title: user.username,
              icon: props => (
                <Avatar {...props} className="h-6 w-6">
                  {user.username && user.username[0].toUpperCase()}
                </Avatar>
              ),
              url: UrlService.userProfile(user.username),
              activeRoutes: [UrlService.userProfile(user.username)]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Templates",
              icon: props => <MediaImageList {...props} />,
              url: UrlService.userProfile(user.username),
              activeRoutes: [UrlService.userProfile(user.username)]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Addresses",
              icon: props => <BookStack {...props} />,
              url: UrlService.userAddressBook(),
              activeRoutes: [UrlService.userAddressBook()]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Settings",
              icon: props => <Settings {...props} />,
              url: UrlService.userSettings(),
              activeRoutes: [UrlService.userSettings()]
            }}
          />
          <SidebarRouteButton
            route={{
              title: "Logout",
              icon: props => <LogOut {...props} />,
              url: UrlService.logout(),
              activeRoutes: []
            }}
          />
        </div>
      ) : (
        <div className="p-2">
          <li className="">
            {/* <Button component={Link} href={UrlService.signup()} color="secondary" variant="contained" fullWidth>
              Sign up
            </Button> */}

            <Link href={UrlService.signup()} className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full")}>
              Sign up
            </Link>
          </li>
          <li>
            <Link href={UrlService.login()} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}>
              Sign in
            </Link>
          </li>
        </div>
      )}

      <Separator className="mb-4" />
    </ul>
  );
};
