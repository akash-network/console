"use client";
import { Avatar, AvatarFallback, AvatarImage, Card, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { MediaImage } from "iconoir-react";

type Props = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  onClick: () => void;
  children?: React.ReactNode;
  testId?: string;
};

export const DeployOptionBox: React.FunctionComponent<Props> = ({ title, description, icon, imageUrl, onClick, testId }) => {
  return (
    <Card className="min-h-[100px] cursor-pointer hover:bg-secondary/60 dark:hover:bg-secondary/30" onClick={onClick} data-testid={testId}>
      <CardHeader>
        <div className="flex items-center">
          {icon ? (
            <Avatar className="h-10 w-10">
              <AvatarFallback>{icon}</AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarImage src={imageUrl} alt={title} />
              <AvatarFallback>
                <MediaImage />
              </AvatarFallback>
            </Avatar>
          )}

          <div className="ml-4 font-bold tracking-tight">{title}</div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};
