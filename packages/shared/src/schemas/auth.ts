import { z } from "zod";

const Email = z.string().trim().toLowerCase().pipe(z.email());

const NewPassword = z.string().min(12).max(128);

export const SignupSchema = z.object({
  email: Email,
  password: NewPassword,
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50)
});
export type Signup = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: Email,
  password: z.string().min(1).max(128)
});
export type Login = z.infer<typeof LoginSchema>;

// POST /auth/password: the first password for an account made with Google (which has none).
export const SetPasswordSchema = z.object({
  password: NewPassword,
});
export type SetPassword = z.infer<typeof SetPasswordSchema>;

// POST /auth/apple: what Sign in with Apple gives the iOS app. The name comes only the first
// time someone signs in with Apple (Apple never sends it again); the token is checked by the API.
export const AppleSignInSchema = z.object({
  identityToken: z.string().min(1).max(10_000),
  nonce: z.string().min(16).max(200), // the random value whose SHA-256 is in the token
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
});
export type AppleSignIn = z.infer<typeof AppleSignInSchema>;
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
