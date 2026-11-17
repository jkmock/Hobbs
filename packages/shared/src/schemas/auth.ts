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
// PATCH /profile
export const UpdateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

// PUT /profile/avatar: the picture as a data URL ("data:image/jpeg;base64,..."), already
// shrunk by the app. 400,000 characters of base64 is about 300 KB.
export const AvatarUploadSchema = z.object({
  image: z.string().max(400_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
});
export type AvatarUpload = z.infer<typeof AvatarUploadSchema>;
