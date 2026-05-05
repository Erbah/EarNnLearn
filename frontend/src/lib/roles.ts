/**
 * LearNnEarn - Role-Based Access Control Constants
 * Mirrored from backend_v2/app/core/permissions.py
 */

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  EDUCATION_ADMIN: "EDUCATION_ADMIN",
  USER: "USER",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Access levels for frontend route guarding
 */
export const ACCESS_LEVELS = {
  ADMIN_ONLY: [ROLES.SUPER_ADMIN],
  EDUCATION_ADMIN_LEVEL: [ROLES.SUPER_ADMIN, ROLES.EDUCATION_ADMIN],
  USER_LEVEL: [ROLES.SUPER_ADMIN, ROLES.EDUCATION_ADMIN, ROLES.USER],
};

/**
 * Helper to check if a user role has the required access level
 */
export const hasAccess = (userRole: string | undefined, requiredRoles: string[]): boolean => {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
};
