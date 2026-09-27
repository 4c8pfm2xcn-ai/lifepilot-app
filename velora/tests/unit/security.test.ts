import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http";
import { sniffImageType } from "@/lib/security/image";
import { isOwnedPath } from "@/lib/storage";
import { isProtectedPath } from "@/lib/supabase/proxy";

describe("sniffImageType", () => {
  it("detects real image signatures", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });

  it("rejects disguised files", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("isOwnedPath", () => {
  const user = "11111111-1111-4111-8111-111111111111";
  it("only accepts paths under the user's folder", () => {
    expect(isOwnedPath(`${user}/a.png`, user)).toBe(true);
    expect(isOwnedPath(`22222222-2222-4222-8222-222222222222/a.png`, user)).toBe(false);
    expect(isOwnedPath(`${user}/../other/a.png`, user)).toBe(false);
  });
});

describe("route protection", () => {
  it("protects app pages but not public pages", () => {
    for (const p of ["/dashboard", "/create", "/library", "/favorites", "/projects/abc", "/settings", "/generations/x"]) {
      expect(isProtectedPath(p), p).toBe(true);
    }
    for (const p of ["/", "/auth/sign-in", "/auth/sign-up", "/dashboardx"]) {
      expect(isProtectedPath(p), p).toBe(false);
    }
  });
});

describe("assertSameOrigin", () => {
  const req = (origin: string | null, host = "velora.app") =>
    new Request("https://velora.app/api/generate", { method: "POST", headers: { host, ...(origin ? { origin } : {}) } });

  it("allows same-origin requests", () => {
    expect(() => assertSameOrigin(req("https://velora.app"))).not.toThrow();
  });
  it("rejects cross-site requests", () => {
    expect(() => assertSameOrigin(req("https://evil.example"))).toThrow(AppError);
  });
});
