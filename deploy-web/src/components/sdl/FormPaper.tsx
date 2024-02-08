"use client";
import { Card, CardContent } from "../ui/card";

// export const FormPaper = styled(Paper)(({ theme }) => ({
//   backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : theme.palette.grey[100]
// }));

export function FormPaper({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  // TODO
  return (
    <Card className={className}>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
