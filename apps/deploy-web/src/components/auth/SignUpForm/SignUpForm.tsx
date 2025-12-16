import { useForm } from "react-hook-form";
import { Button, Checkbox, Form, FormField, FormInput, FormMessage, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Undo2 } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { useBackNav } from "@src/hooks/useBackNav";

const LOWER_LETTER_REGEX = /\p{Ll}/u;
const UPPER_LETTER_REGEX = /\p{Lu}/u;
const DIGIT_REGEX = /\p{Nd}/u;
const SPECIAL_CHAR_REGEX = /[^\p{L}\p{N}]/u;

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().refine(
    password => {
      return (
        password.length >= 8 &&
        UPPER_LETTER_REGEX.test(password) &&
        LOWER_LETTER_REGEX.test(password) &&
        DIGIT_REGEX.test(password) &&
        SPECIAL_CHAR_REGEX.test(password)
      );
    },
    {
      message:
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit and one special character"
    }
  ),
  termsAndConditions: z.boolean().refine(Boolean, {
    message: "You must accept the terms and conditions"
  })
});

export type SignUpFormValues = z.infer<typeof formSchema>;

type Props = {
  isLoading?: boolean;
  onSubmit: (values: SignUpFormValues) => void;
};

export function SignUpForm(props: Props) {
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      termsAndConditions: false
    }
  });
  const goBack = useBackNav("/");
  const emitSubmit = form.handleSubmit(values => props.onSubmit(values));

  return (
    <Form {...form}>
      <form noValidate={true} className="flex flex-col items-center justify-start gap-5 self-stretch" autoComplete="off" onSubmit={emitSubmit}>
        <div className="flex flex-col items-start justify-start gap-4 self-stretch">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormInput
                className="w-full"
                type="email"
                label="Email"
                placeholder="m@example.com"
                value={field.value}
                onChange={event => field.onChange(event.target.value)}
              />
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormInput
                className="w-full"
                type="password"
                label="Password"
                placeholder="••••••••"
                value={field.value}
                onChange={event => field.onChange(event.target.value)}
              />
            )}
          />
          <FormField
            control={form.control}
            name="termsAndConditions"
            render={({ field }) => (
              <div>
                <label className="flex cursor-pointer items-center space-x-2">
                  <Checkbox onCheckedChange={field.onChange} checked={field.value} />
                  <span>
                    I have read and agree to{" "}
                    <Link prefetch={false} target="_blank" href="/terms-of-service">
                      Terms of Services
                    </Link>
                    .
                  </span>
                </label>
                <FormMessage />
              </div>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-5 self-stretch sm:flex-row">
          <Button type="button" onClick={goBack} variant="outline" className="h-9 flex-1 border-neutral-200 dark:border-neutral-800">
            <Undo2 className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button disabled={!!props.isLoading} type="submit" className="h-9 flex-1">
            <LogIn className="mr-2 h-4 w-4" />
            {props.isLoading ? <Spinner size="small" /> : "Sign up"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
