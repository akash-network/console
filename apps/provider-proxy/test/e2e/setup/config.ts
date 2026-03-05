import z from "zod";

const schema = z.object({
  SERVICE_BASE_URL: z.string().url(),
  CONSOLE_API_BASE_URL: z.string().url()
});

export const config = schema.parse(process.env);
