import { describe, expect, it, beforeEach } from "vitest";
import { CORRUPT_SAVE_BACKUP_KEY, loadLocalSave } from "./localStore";

const saveKey = "echo_forge_account_save_v1";

describe("local save adapter", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("backs up corrupt raw JSON before resetting to a new save", () => {
    window.localStorage.setItem(saveKey, "{bad json");

    const save = loadLocalSave();

    expect(save.schemaVersion).toBe(7);
    expect(window.localStorage.getItem(CORRUPT_SAVE_BACKUP_KEY)).toBe("{bad json");
  });
});
