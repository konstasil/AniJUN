export const ADMIN_IDS = [
  "8fa96992-b063-4019-83a6-3acac8cc712f",
  "cc91e0bb-a24b-41ab-ba41-3bd352ed9add",
];

export function isAdminId(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_IDS.includes(userId);
}