import { z } from "zod";

export const CONTACT_ROLES = ["BRAND", "CREATOR", "CUSTOMER", "OTHER"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const CONTACT_ROLE_LABEL: Record<ContactRole, string> = {
  BRAND: "Brand",
  CREATOR: "Creator",
  CUSTOMER: "Customer",
  OTHER: "Other",
};

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(80),
  email: z.string().trim().min(5, "Please enter your email address").max(120).email("Enter a valid email address"),
  role: z.enum(CONTACT_ROLES, { message: "Tell us which best describes you" }),
  subject: z.string().trim().min(3, "Please add a subject").max(120),
  message: z.string().trim().min(20, "Please add a little more detail (at least 20 characters)").max(4000),
  // Honeypot: real visitors never fill this.
  company: z.string().max(0).optional().or(z.literal("")),
});

export type ContactMessageInput = z.input<typeof contactMessageSchema>;
