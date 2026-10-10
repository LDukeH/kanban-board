import { describe, expect, it } from "vitest";
import {
  avatarGradient,
  avatarSeed,
  emailInitial,
  emailToHandle,
  roleLabel,
} from "@/lib/memberDisplay";

describe("roleLabel", () => {
  it("maps each workspace role to its display label", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("member")).toBe("Member");
  });
});

describe("emailToHandle", () => {
  it("prefixes the local part with @", () => {
    expect(emailToHandle("ada@example.com")).toBe("@ada");
    expect(emailToHandle("no-domain")).toBe("@no-domain");
    expect(emailToHandle("")).toBe("@");
  });
});

describe("emailInitial", () => {
  it("uppercases the first character of the email", () => {
    expect(emailInitial("alice@example.com")).toBe("A");
    expect(emailInitial("bob")).toBe("B");
  });

  it("falls back to a question mark for an empty email", () => {
    expect(emailInitial("")).toBe("?");
  });
});

describe("avatarGradient", () => {
  const palette = [
    "from-indigo-500 to-violet-600",
    "from-sky-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-fuchsia-500 to-purple-600",
  ];

  it("is deterministic for the same seed", () => {
    expect(avatarGradient("alice@example.com")).toBe(avatarGradient("alice@example.com"));
  });

  it("always returns one of the known palette gradients", () => {
    for (const seed of ["alice@example.com", "bob", "a", "zzz@long-domain.example", ""]) {
      expect(palette).toContain(avatarGradient(seed));
    }
  });
});

describe("avatarSeed", () => {
  it("keys avatar color by normalized email so every surface matches", () => {
    expect(avatarSeed({ email: "Ada@Example.com" })).toBe("ada@example.com");
    expect(avatarGradient(avatarSeed({ email: "Ada@Example.com" }))).toBe(
      avatarGradient(avatarSeed({ email: "ada@example.com" })),
    );
  });

  it("falls back to empty string when no email is available", () => {
    expect(avatarSeed({})).toBe("");
    expect(avatarSeed({ email: null })).toBe("");
  });
});