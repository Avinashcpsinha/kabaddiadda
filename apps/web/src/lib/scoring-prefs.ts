const REQUIRE_CONFIRM_KEY = 'kabaddi.scoring.requireConfirm';

export function readRequireConfirm(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(REQUIRE_CONFIRM_KEY);
  return v === null ? true : v === 'true';
}

export function writeRequireConfirm(value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REQUIRE_CONFIRM_KEY, String(value));
}
