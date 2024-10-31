"use client";
import { Card, CardContent, CardFooter, CardHeader } from "@akashnetwork/ui/components";
import Image from "next/image";

type Props = {
  title: string;
  description: string;
  topIcons: string[];
  bottomIcons?: string[];
  onClick: () => void;
  children?: React.ReactNode;
  testId?: string;
};

export const DeployOptionBox: React.FunctionComponent<Props> = ({ title, description, topIcons, bottomIcons, onClick, testId }) => {
  return (
    <Card className="min-h-[100px] cursor-pointer text-center hover:bg-secondary/60 dark:hover:bg-secondary/30" onClick={onClick} data-testid={testId}>
      <CardHeader className="pb-2">
        <div className="mb-2 flex items-center justify-center">
          <div className="flex items-center space-x-1 rounded-sm bg-secondary p-1">
            {topIcons?.map((icon, i) => <Image src={icon} alt="icon" width={20} height={20} key={i} />)}
          </div>
        </div>
        <div className="font-bold tracking-tight">{title}</div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">{description}</p>
      </CardContent>

      <CardFooter className="flex justify-center">
        <div className="flex items-center space-x-1 px-2 py-1">
          {bottomIcons?.map((icon, i) => (
            <div key={i} className="rounded-sm border px-2 py-1">
              <Image src={icon} alt="icon" width={20} height={20} />
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
};
