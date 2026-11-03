import { z } from "zod";

const Email = z.string().trim().toLowerCase().pipe(z.email());

export const SignupSchema = z.object({
  email: Email,
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50)
});
export type Signup = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: Email,
  password: z.string().min(1).max(128)
});
export type Login = z.infer<typeof LoginSchema>;