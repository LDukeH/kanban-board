import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations/auth.schema";

describe("loginSchema", () => {
  it("accepts a valid email and 8+ character password", () => {
    const result = loginSchema.safeParse({ email: "ada@example.com", password: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "12345678" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid email address");
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = loginSchema.safeParse({ email: "ada@example.com", password: "1234567" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Password must be at least 8 characters long");
    }
  });
});

describe("registerSchema", () => {
  it("accepts matching passwords", () => {
    const result = registerSchema.safeParse({
      email: "ada@example.com",
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords on the confirmPassword field", () => {
    const result = registerSchema.safeParse({
      email: "ada@example.com",
      password: "12345678",
      confirmPassword: "87654321",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Passwords do not match");
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects a short confirm password", () => {
    const result = registerSchema.safeParse({
      email: "ada@example.com",
      password: "12345678",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Password must be at least 8 characters long");
    }
  });
});