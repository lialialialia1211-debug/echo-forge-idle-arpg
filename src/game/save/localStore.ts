import { createNewAccountSave, type AccountSave } from "./schema";
import { migrateUnknownSave } from "./migrations";

const SAVE_KEY = "echo_forge_account_save_v1";
export const CORRUPT_SAVE_BACKUP_KEY = "echo_forge_account_save_v1_corrupt_backup";

export function loadLocalSave(): AccountSave {
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return createNewAccountSave();
  }

  try {
    return migrateUnknownSave(JSON.parse(raw));
  } catch {
    window.localStorage.setItem(CORRUPT_SAVE_BACKUP_KEY, raw);
    return createNewAccountSave();
  }
}

export function writeLocalSave(save: AccountSave): void {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function exportLocalSave(save: AccountSave): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(save))));
}

export function importLocalSave(encoded: string): AccountSave {
  const decoded = JSON.parse(decodeURIComponent(escape(atob(encoded))));
  return migrateUnknownSave(decoded);
}
