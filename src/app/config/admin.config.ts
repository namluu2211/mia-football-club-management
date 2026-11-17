// 🛡️ Admin Configuration for ThangLong FC
// This file centralizes all admin access control rules

import adminUsersJson from './admin-users.json';

// Source of truth for admins is admin-users.json (also read by scripts/generate-firebase-rules.js).
// NOTE: this list only drives the UI. Real write access is enforced by database.rules.json / storage.rules.
export interface AdminUser {
  email: string;
  username: string;
  displayName: string;
  role: 'superadmin' | 'admin';
  permissions: string[];
}

// 👥 Admin Users Configuration
export const ADMIN_USERS: AdminUser[] = adminUsersJson as AdminUser[];

// 📧 Quick lookup arrays for Firebase rules
export const ADMIN_EMAILS = ADMIN_USERS.map(user => user.email);
export const SUPER_ADMIN_EMAILS = ADMIN_USERS.filter(user => user.role === 'superadmin').map(user => user.email);

// 🎯 Helper Functions
export class AdminConfig {
  
  // Check if email is admin
  static isAdminEmail(email: string): boolean {
    return ADMIN_EMAILS.includes(email);
  }

  // Check if email is super admin
  static isSuperAdminEmail(email: string): boolean {
    return SUPER_ADMIN_EMAILS.includes(email);
  }

  // Get admin user by email
  static getAdminByEmail(email: string): AdminUser | null {
    return ADMIN_USERS.find(user => user.email === email) || null;
  }

  // Check if user has specific permission
  static hasPermission(userEmail: string, permission: string): boolean {
    const user = this.getAdminByEmail(userEmail);
    return user ? user.permissions.includes(permission) : false;
  }

}

// 📋 Export commonly used lists
export {
  ADMIN_EMAILS as adminEmails,
  SUPER_ADMIN_EMAILS as superAdminEmails
};