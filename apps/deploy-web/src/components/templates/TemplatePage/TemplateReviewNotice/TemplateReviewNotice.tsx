import type { FC } from "react";
import { BadgeCheck, ShieldAlert } from "lucide-react";

export const TemplateReviewNotice: FC<{ isOfficial: boolean; publisherName: string | undefined }> = ({ isOfficial, publisherName }) =>
  isOfficial ? (
    <p
      role="note"
      className="flex items-start gap-2.5 rounded-xl border border-blue-600/25 bg-blue-600/5 px-4 py-3 text-[13.5px] leading-5 text-blue-900 dark:text-blue-200"
    >
      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Official template.</strong> Akash staff reviewed this template and review each new version before it becomes the
        current one.
      </span>
    </p>
  ) : (
    <p
      role="note"
      className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13.5px] leading-5 text-amber-900 dark:text-amber-200"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">
        <strong className="font-semibold">Not reviewed by Akash.</strong> {publisherName ?? "A Console user"} published this template. Akash runs automated
        checks on every version, but nobody at Akash has reviewed it. Check the images and the SDL before you deploy, and never paste keys you can&apos;t
        rotate.
      </span>
    </p>
  );
