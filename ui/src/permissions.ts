import { sessionState } from "./session";

/**
 * Check if the current user has a specific permission.
 */
export function hasPermission(key: string): boolean {
  return sessionState.session?.auth.permissionKeys.includes(key) ?? false;
}

/**
 * Check if the current user has ANY of the given permissions.
 */
export function hasAnyPermission(...keys: string[]): boolean {
  const perms = sessionState.session?.auth.permissionKeys;
  if (!perms) return false;
  return keys.some((k) => perms.includes(k));
}
