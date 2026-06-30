import { accountSaveSchema, type AccountSave } from "./schema";

export function migrateUnknownSave(input: unknown): AccountSave {
  return accountSaveSchema.parse(input);
}
