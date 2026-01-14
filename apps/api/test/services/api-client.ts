import axios from "axios";
import { z } from "zod";

export const apiClient = axios.create({
  baseURL: z.string().url().parse(process.env.TEST_API_BASE_URL),
  validateStatus: () => true
});
