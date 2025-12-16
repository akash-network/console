import { useForm } from "react-hook-form";
import { Button, Form, FormField, FormInput, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Undo2 } from "lucide-react";
import { z } from "zod";

import { useBackNav } from "@src/hooks/useBackNav";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: "Required" })
});

export type SignInFormValues = z.infer<typeof formSchema>;

interface Props {
  isLoading?: boolean;
  onSubmit: (values: SignInFormValues) => void;
}

export function SignInForm(props: Props) {
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });
  const goBack = useBackNav("/");
  const emitSubmit = form.handleSubmit(values => props.onSubmit(values));

  return (
    <Form {...form}>
      <form noValidate={true} autoComplete="on" onSubmit={emitSubmit} className="flex flex-col items-center justify-start gap-5 self-stretch">
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
        </div>
        <div className="flex flex-col-reverse gap-5 self-stretch sm:flex-row">
          <Button type="button" onClick={goBack} variant="outline" className="h-9 flex-1 border-neutral-200 dark:border-neutral-800">
            <Undo2 className="mr-2 h-4 w-4" />
            Go Back
          </Button>

          <Button disabled={!!props.isLoading} type="submit" className="h-9 flex-1">
            <LogIn className="mr-2 h-4 w-4" />
            {props.isLoading ? <Spinner size="small" /> : "Log in"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
