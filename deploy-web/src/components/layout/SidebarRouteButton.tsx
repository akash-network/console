"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { ISidebarRoute } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { buttonVariants } from "../ui/button";

// const useStyles = makeStyles()(theme => ({
//   notSelected: {
//     color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700],
//     fontWeight: 500
//   },
//   selected: {
//     fontWeight: "bold"
//   }
// }));

type Props = {
  children?: ReactNode;
  route: ISidebarRoute;
  isNavOpen?: boolean;
  className?: string;
};

export const SidebarRouteButton: React.FunctionComponent<Props> = ({ route, className = "", isNavOpen = true }) => {
  const router = useRouter();
  const pathname = usePathname();
  const isSelected = route.url === UrlService.home() ? pathname === "/" : route.activeRoutes.some(x => pathname?.startsWith(x));

  return (
    <li>
      <Link
        target={route.isExternal ? "_blank" : "_self"}
        rel={route.rel ? route.rel : ""}
        href={route.url}
        className={cn(buttonVariants({ variant: isSelected ? "secondary" : "ghost", size: "sm" }), "text-md flex w-full items-center justify-start", {
          // ["mt-2"]: index > 0,
          // ["text-foreground"]: route.variant === "ghost"
        })}
      >
        {!!route.icon && <span className="mr-2">{route.icon}</span>}
        {route.title}
        {/* {route.label && <span className={cn("ml-auto", route.variant === "default" && "text-background dark:text-white")}>{link.label}</span>} */}
      </Link>
    </li>
  );
};

// <Button
//   fullWidth
//   href={route.url}
//   component={Link}
//   color="inherit"
//   className={cx({
//     [classes.selected]: isSelected,
//     [classes.notSelected]: !isSelected
//   })}
//   sx={{
//     justifyContent: "flex-start",
//     textTransform: "initial",
//     fontSize: "1rem",
//     height: "40px",
//     padding: isNavOpen ? ".2rem 1rem" : ".5rem",
//     minWidth: isNavOpen ? "initial" : 0,
//     ...sx
//   }}
// >
//   <ListItemIcon sx={{ minWidth: 0, zIndex: 100, margin: isNavOpen ? "initial" : "0 auto" }}>
//     {route.icon({ color: isSelected ? "secondary" : "disabled" })}
//   </ListItemIcon>

//   {isNavOpen && (
//     <ListItemText
//       sx={{ marginLeft: "1rem", whiteSpace: "nowrap" }}
//       primaryTypographyProps={{
//         className: cx({ [classes.selected]: isSelected, [classes.notSelected]: !isSelected }),
//         style: { opacity: isNavOpen ? 1 : 0 }
//       }}
//       primary={
//         <>
//           {route.title}
//           {route.isNew && <Chip variant="outlined" sx={{ marginLeft: 2, cursor: "pointer" }} label="NEW" size="small" color="secondary" />}
//         </>
//       }
//     />
//   )}
// </Button>
