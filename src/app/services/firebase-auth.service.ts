import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import type { User, Auth } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';
import { firebaseConfig } from '../config/firebase.config';
import { AdminConfig, ADMIN_EMAILS, SUPER_ADMIN_EMAILS } from '../config/admin.config';

export interface AuthUser {
  email: string;
  uid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  displayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  private app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  /** firebase/auth (~75 KB) is fetched on first use so it stays out of the initial bundle. */
  private authReady: Promise<{ auth: Auth; api: typeof import('firebase/auth') }> = import('firebase/auth')
    .then(api => ({ api, auth: api.getAuth(this.app) }));
  
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Admin email configuration from centralized config
  private adminEmails = ADMIN_EMAILS;
  private superAdminEmails = SUPER_ADMIN_EMAILS;

  constructor() {
    // Listen for auth state changes
    this.authReady
      .then(({ auth, api }) => api.onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const authUser = this.createAuthUser(firebaseUser);
        this.currentUserSubject.next(authUser);
      } else {
        this.currentUserSubject.next(null);
      }
      }))
      .catch(err => console.error('Firebase auth failed to load:', err));
  }

  private createAuthUser(firebaseUser: User): AuthUser {
    const email = firebaseUser.email || '';
    const isAdmin = this.isAdminEmail(email);
    const isSuperAdmin = this.isSuperAdminEmail(email);
    
    return {
      email,
      uid: firebaseUser.uid,
      isAdmin,
      isSuperAdmin,
      displayName: this.getDisplayNameFromEmail(email)
    };
  }

  private getDisplayNameFromEmail(email: string): string {
    const admin = AdminConfig.getAdminByEmail(email);
    return admin ? admin.displayName : email.split('@')[0];
  }

  async signInWithEmail(email: string, password: string): Promise<AuthUser | null> {
    try {
      
      const { auth, api } = await this.authReady;
      const userCredential = await api.signInWithEmailAndPassword(auth, email, password);
      const authUser = this.createAuthUser(userCredential.user);
      
      console.log('✅ Firebase auth successful for:', email);
      
      // Only allow admin users to sign in
      if (!authUser.isAdmin) {
        console.error('❌ User is not admin:', email);
        await this.signOut();
        throw new Error(`Unauthorized: ${email} is not in the admin list. Contact administrator to add your email to the system.`);
      }
      
      console.log('🎉 Login successful for admin user:', authUser.displayName);
      return authUser;
    } catch (error: unknown) {
      console.error('🚨 Sign in error for', email, ':', error);
      if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
        const err = error as { code: string; message: string };
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        throw new Error(this.getErrorMessage(err.code));
      } else {
        throw new Error('Đăng nhập thất bại. Vui lòng thử lại');
      }
    }
  }

  async signOut(): Promise<void> {
    try {
      const { auth, api } = await this.authReady;
      await api.signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user ? user.isAdmin : false;
  }

  isSuperAdmin(): boolean {
    const user = this.getCurrentUser();
    return user ? user.isSuperAdmin : false;
  }

  private isAdminEmail(email: string): boolean {
    return AdminConfig.isAdminEmail(email);
  }

  private isSuperAdminEmail(email: string): boolean {
    return AdminConfig.isSuperAdminEmail(email);
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Không tìm thấy tài khoản với email này';
      case 'auth/wrong-password':
        return 'Mật khẩu không chính xác';
      case 'auth/invalid-email':
        return 'Email không hợp lệ';
      case 'auth/user-disabled':
        return 'Tài khoản đã bị vô hiệu hóa';
      case 'auth/too-many-requests':
        return 'Quá nhiều lần thử. Vui lòng thử lại sau';
      default:
        return 'Đăng nhập thất bại. Vui lòng thử lại';
    }
  }

  // Method to check if current user can write to Firebase
  canWriteToFirebase(): boolean {
    const user = this.getCurrentUser();
    return user ? user.isAdmin : false;
  }

  // Get current user email for Firebase rules
  getCurrentUserEmail(): string | null {
    const user = this.getCurrentUser();
    return user ? user.email : null;
  }
}