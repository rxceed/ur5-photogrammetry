/**
 * Cookie utility functions
 */

export interface CookieOptions {
  days?: number;
  path?: string;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key?.trim() === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Set a cookie
 */
export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  const { days = 7, path = "/", secure = false, sameSite = "Lax" } = options;

  const expires = new Date();
  expires.setDate(expires.getDate() + days);

  let cookieStr = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=${path}; SameSite=${sameSite}`;
  if (secure) cookieStr += "; Secure";

  document.cookie = cookieStr;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}