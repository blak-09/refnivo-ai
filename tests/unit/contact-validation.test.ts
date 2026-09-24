import { describe, expect, it } from "vitest";
import { contactMessageSchema } from "@/lib/validation/contact";
import { contactInbox, mailto, CONTACT_EMAIL, SOCIALS } from "@/lib/config/contact";

const valid = { name: "Asha R", email: "asha@example.com", role: "BRAND", subject: "Partnership", message: "We sell headphones and want to run a creator campaign." };

describe("contact message validation", () => {
  it("accepts a complete message", () => {
    expect(contactMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing name, a bad email, an unknown role and a too-short message", () => {
    const errorFor = (patch: Record<string, unknown>) => {
      const res = contactMessageSchema.safeParse({ ...valid, ...patch });
      return res.success ? null : res.error.issues[0].path[0];
    };
    expect(errorFor({ name: " " })).toBe("name");
    expect(errorFor({ email: "not-an-email" })).toBe("email");
    expect(errorFor({ role: "ROBOT" })).toBe("role");
    expect(errorFor({ subject: "" })).toBe("subject");
    expect(errorFor({ message: "too short" })).toBe("message");
  });

  it("treats a filled honeypot as invalid input for the schema's company field", () => {
    expect(contactMessageSchema.safeParse({ ...valid, company: "bot corp" }).success).toBe(false);
  });
});

describe("contact configuration", () => {
  it("uses the published address unless an inbox override is set", () => {
    const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;
    expect(contactInbox(env({}))).toBe(CONTACT_EMAIL);
    expect(contactInbox(env({ CONTACT_INBOX_EMAIL: "team@example.com" }))).toBe("team@example.com");
  });

  it("builds mailto links with an encoded subject", () => {
    expect(mailto()).toBe(`mailto:${CONTACT_EMAIL}`);
    expect(mailto("Brand Partnership Inquiry – Refnivo")).toBe(`mailto:${CONTACT_EMAIL}?subject=Brand%20Partnership%20Inquiry%20%E2%80%93%20Refnivo`);
  });

  it("points at the official profiles over https", () => {
    expect(SOCIALS.map((s) => s.href)).toEqual(["https://www.youtube.com/@Refnivo", "https://www.instagram.com/refnivo/"]);
  });
});
