import { z } from "zod";
import { optionalImageRef } from "./brand";

export const accountSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  avatarUrl: optionalImageRef,
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 ()-]{8,16}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Password must include a letter")
      .regex(/[0-9]/, "Password must include a number"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
