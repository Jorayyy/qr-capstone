/**
 * Department photos may be an uploaded blob path (`departments/<uuid>.jpg`) or
 * an external https image link pasted by an admin. Never proxies remote URLs.
 */
export function departmentPhotoSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  return `/api/department-photo?path=${encodeURIComponent(path)}`;
}
