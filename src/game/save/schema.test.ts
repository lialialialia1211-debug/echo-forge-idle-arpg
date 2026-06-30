import { describe, expect, it } from "vitest";
import { accountSaveSchema, createNewAccountSave } from "./schema";

describe("save schema", () => {
  it("creates a server-compatible local account shell", () => {
    const save = createNewAccountSave("ironbound");
    const parsed = accountSaveSchema.parse(save);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.accountId).toBeNull();
    expect(parsed.roster[0].classId).toBe("ironbound");
    expect(parsed.roster[0].build.supportIds.length).toBeGreaterThan(0);
  });
});
