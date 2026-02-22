import { describe, expect, it } from "vitest";
import { assertExpectedVersion } from "../mutations";

describe("submitAction concurrency guard", () => {
  it("rejects missing expectedVersion", () => {
    expect(() => assertExpectedVersion(4, undefined)).toThrow(
      "submitAction expectedVersion is required",
    );
  });

  it("rejects stale expectedVersion", () => {
    expect(() => assertExpectedVersion(4, 3)).toThrow(
      "submitAction version mismatch; state updated by another action.",
    );
  });

  it("accepts matching expectedVersion", () => {
    expect(() => assertExpectedVersion(4, 4)).not.toThrow();
  });
});
