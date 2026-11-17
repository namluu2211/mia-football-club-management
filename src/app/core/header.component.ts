import { Component, EventEmitter, Output, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NAV_LINKS, NavLink } from '../shared/navigation-links';
import { AdminConfig } from '../config/admin.config';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { AIWorkerService } from '../features/players/services/ai-worker.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="header-container" role="banner" aria-label="Application header">
    <!-- Logo Section -->
    <div class="logo-section" role="link" tabindex="0" aria-label="Trang chủ Thăng Long FC">
      <div class="logo-icon" aria-hidden="true">
        <i class="fas fa-futbol"></i>
      </div>
      <div class="logo-text" aria-label="Tên ứng dụng">
        <span class="logo-main">Thăng Long FC</span>
        <span class="logo-subtitle">Team Management</span>
      </div>
    </div>
  
    <!-- Navigation Links -->
    <nav class="nav-links" aria-label="Điều hướng chính">
      @for (link of navLinks; track link) {
        <a
          class="nav-link"
          [routerLink]="link.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="link.exact ? { exact: true } : {}"
          [attr.aria-label]="link.label"
          [attr.aria-current]="isLinkActive(link.path) ? 'page' : null">
          @if (link.icon) {
            <i [class]="link.icon" aria-hidden="true"></i>
          }
          <span class="nav-text">{{link.label}}</span>
        </a>
      }
    </nav>
  
    <!-- AI Mode Badge -->
    @if (aiMode !== 'idle') {
      <div class="ai-mode-badge" [class.worker]="aiMode==='worker'" [class.fallback]="aiMode==='fallback'" aria-label="Trạng thái phân tích AI">
        <i class="fas fa-robot" aria-hidden="true"></i>
        <span>{{ aiMode==='worker' ? 'AI nhanh' : 'AI dự phòng' }}</span>
        @if (lastAIDuration) {
          <small class="duration">{{ lastAIDuration }}ms</small>
        }
      </div>
    }
  
    <!-- Login Section -->
    <div class="auth-section" role="navigation" aria-label="Tài khoản người dùng">
      <!-- Modal Backdrop -->
      @if (!loggedIn && showLoginForm) {
        <div
          class="modal-backdrop"
          tabindex="0"
          aria-label="Đóng biểu mẫu đăng nhập"
          (click)="closeLoginForm()"
          (keydown)="onBackdropKeydown($event)">
        </div>
      }
  
      <!-- Login Form -->
      @if (!loggedIn && showLoginForm) {
        <div class="login-form expanded" role="dialog" aria-modal="true" aria-labelledby="loginHeading">
          <div class="form-header">
            <h4 id="loginHeading">🔥 Login</h4>
            <button class="close-btn" (click)="closeLoginForm()">×</button>
          </div>
          <form class="form-content" (submit)="login(); $event.preventDefault()">
            <div class="input-group" aria-label="Email đăng nhập">
              <input
                type="email"
                [(ngModel)]="email"
                placeholder="📧 Email đăng nhập"
                autocomplete="email"
                required>
              </div>
              <div class="input-group" aria-label="Mật khẩu">
                <input
                  type="password"
                  [(ngModel)]="password"
                  placeholder="🔒 Mật khẩu"
                  autocomplete="current-password"
                  required>
                </div>
                <button type="submit" class="login-btn" [disabled]="isLoading || !email || !password">
                  <i class="fas fa-sign-in-alt"></i>
                  {{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}}
                </button>
              </form>
              <!-- Firebase Setup Hint -->
              <div class="firebase-hint">
                <small>💡 Sử dụng email và mật khẩu Authentication</small>
              </div>
            </div>
          }
  
          <!-- Login Button -->
          @if (!loggedIn) {
            <div class="login-container" aria-label="Khu vực đăng nhập">
              <button class="login-toggle-btn" (click)="toggleLoginForm()">
                <i class="fas fa-sign-in-alt"></i>
                Đăng Nhập
              </button>
            </div>
          }
  
          <!-- User Profile Section -->
          @if (loggedIn) {
            <div class="user-profile" aria-label="Thông tin người dùng">
              <div
                class="user-info"
                tabindex="0"
                role="button" aria-haspopup="true" aria-expanded="{{showUserMenu}}" aria-label="Mở menu người dùng"
                (click)="toggleUserMenu()"
                (keydown)="onUserInfoKeydown($event)">
                <div class="user-avatar">
                  <div class="avatar-placeholder">
                    {{getInitials()}}
                  </div>
                </div>
                <div class="user-details">
                  <span class="user-name">{{getDisplayName()}}</span>
                  <span class="user-role">{{getRoleDisplayName()}}</span>
                </div>
                <i class="fas fa-chevron-down" [class.rotated]="showUserMenu"></i>
              </div>
              <!-- User Dropdown Menu -->
              @if (showUserMenu) {
                <div class="user-dropdown" role="menu" aria-label="Menu người dùng">
                  <div class="dropdown-header">
                    <div class="dropdown-avatar">
                      <div class="dropdown-avatar-placeholder">
                        {{getInitials()}}
                      </div>
                    </div>
                    <div class="dropdown-info">
                      <div class="dropdown-name">{{getDisplayName()}}</div>
                      <div class="dropdown-role">{{getRoleDisplayName()}}</div>
                      <div class="dropdown-email">{{getCurrentUserEmail()}}</div>
                    </div>
                  </div>
                  <div class="dropdown-divider"></div>
                  <div class="dropdown-items">
                    <div class="dropdown-item" tabindex="0" role="menuitem" (click)="openProfile()" (keydown)="onDropdownItemKeydown($event, openProfile)">
                      <i class="fas fa-user-edit"></i>
                      Thông tin cá nhân
                    </div>
                    <div class="dropdown-item" tabindex="0" role="menuitem" (click)="openSettings()" (keydown)="onDropdownItemKeydown($event, openSettings)">
                      <i class="fas fa-cog"></i>
                      Cài đặt
                    </div>
                    <div class="dropdown-divider"></div>
                    <div
                      class="dropdown-item logout-item"
                      tabindex="0"
                      role="menuitem"
                      aria-label="Đăng xuất"
                      (click)="logout()"
                      (keydown)="onDropdownItemKeydown($event, logout)">
                      <i class="fas fa-sign-out-alt"></i>
                      Đăng xuất
                    </div>
                  </div>
                </div>
              }
            </div>
          }
  
          <!-- Background overlay for closing dropdown -->
          @if (showUserMenu) {
            <div class="dropdown-overlay"
              tabindex="0"
              (click)="showUserMenu = false"
              (keydown)="onDropdownOverlayKeydown($event)">
            </div>
          }
        </div>
      </div>
  `,
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  @Output() loginChange = new EventEmitter<{loggedIn: boolean; role: string}>();
  
  // Firebase Authentication properties
  email = '';
  password = '';
  loggedIn = false;
  role = '';
  showLoginForm = false;
  showUserMenu = false;
  isLoading = false;
  
  // Current user info from Firebase
  currentUserEmail = '';
  currentUserDisplayName = '';
  
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly aiWorkerService = inject(AIWorkerService);
  private readonly toast = inject(ToastService);
  navLinks: NavLink[] = NAV_LINKS;
  aiMode: 'idle'|'worker'|'fallback' = 'idle';
  lastAIDuration?: number;
  private aiBadgeTimer?: ReturnType<typeof setTimeout>;

  isLinkActive(path:string): boolean {
    // Simple check using location; for robust solution inject Router and check
    return typeof window !== 'undefined' && window.location.pathname === path;
  }

  ngOnInit() {
    // Subscribe to Firebase auth state changes
    this.firebaseAuthService.currentUser$.subscribe(firebaseUser => {
      if (firebaseUser) {
        // User is logged in via Firebase
        this.loggedIn = true;
        this.currentUserEmail = firebaseUser.email;
        this.currentUserDisplayName = firebaseUser.displayName;
        this.role = firebaseUser.isSuperAdmin ? 'superadmin' : 'admin';
        
        // Emit login state
        this.loginChange.emit({ loggedIn: true, role: this.role });
        
        console.log('🔥 Firebase user logged in:', {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: this.role
        });
        // Removed toast notification - only show when user explicitly logs in
      } else {
        // No user logged in
        this.loggedIn = false;
        this.currentUserEmail = '';
        this.currentUserDisplayName = '';
        this.role = '';
        
        // Emit logout state
        this.loginChange.emit({ loggedIn: false, role: '' });
        
        console.log('🔥 No Firebase user logged in');
        // Removed toast notification - user will see "Đăng nhập" button which is enough
      }
    });

    // Subscribe to AI mode changes
  this.aiWorkerService.mode$.subscribe(mode => {
    this.aiMode = mode;
    if (this.aiBadgeTimer) clearTimeout(this.aiBadgeTimer);
    if (mode !== 'idle') {
      this.aiBadgeTimer = setTimeout(() => {
        // reset to idle after inactivity
        this.aiMode = 'idle';
      }, 10000);
    }
  });
  this.aiWorkerService.lastDuration$.subscribe(d => { this.lastAIDuration = d; });
  }

  async login() {
    if (!this.email || !this.password) {
      this.toast.error('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    // Validate email format
    if (!this.isValidEmail(this.email)) {
      this.toast.error('Vui lòng nhập email hợp lệ');
      return;
    }

    // Check if email is in admin configuration
    if (!AdminConfig.isAdminEmail(this.email)) {
      this.toast.error('Email này không có quyền admin. Liên hệ quản trị viên để được cấp quyền.');
      return;
    }

    this.isLoading = true;

    try {
      
      const firebaseUser = await this.firebaseAuthService.signInWithEmail(this.email, this.password);
      
      if (firebaseUser) {
        // Login successful - Firebase auth service will handle state updates
        this.showLoginForm = false;
        this.password = ''; // Clear password for security
  this.toast.success(`🔥 Chào mừng ${firebaseUser.displayName || firebaseUser.email}`);
        
        console.log('🔥 login successful:', firebaseUser);
      }
      
    } catch (error: unknown) {
      console.error('❌ login failed:', error);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
      
      if (errorMsg.includes('user-not-found')) {
        errorMessage = `Không tìm thấy tài khoản Firebase cho email ${this.email}. Vui lòng tạo tài khoản trước.`;
      } else if (errorMsg.includes('wrong-password')) {
        errorMessage = 'Mật khẩu không chính xác.';
      } else if (errorMsg.includes('invalid-email')) {
        errorMessage = 'Email không hợp lệ.';
      } else if (errorMsg.includes('Unauthorized')) {
        errorMessage = 'Email này không có quyền admin.';
      }
      
  this.toast.error(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  async logout() {
    try {
      await this.firebaseAuthService.signOut();
      this.showUserMenu = false;
  this.toast.info('Đã đăng xuất');
      console.log('🔥 Firebase logout successful');
    } catch (error) {
      console.error('❌ Firebase logout failed:', error);
  this.toast.error('Lỗi đăng xuất. Vui lòng thử lại.');
    }
  }

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
  }

  toggleLoginForm() {
    this.showLoginForm = !this.showLoginForm;
  }

  closeLoginForm() {
    this.showLoginForm = false;
    this.email = '';
    this.password = '';
  }

  getDisplayName(): string {
    if (this.currentUserDisplayName) {
      return this.currentUserDisplayName;
    }
    
    // Try to get display name from admin config
    const adminUser = AdminConfig.getAdminByEmail(this.currentUserEmail);
    return adminUser ? adminUser.displayName : this.currentUserEmail.split('@')[0];
  }

  getRoleDisplayName(): string {
    switch (this.role) {
      case 'superadmin': return 'Quản trị viên';
      case 'admin': return 'Quản lý';
      default: return 'Thành viên';
    }
  }

  getCurrentUserEmail(): string {
    return this.currentUserEmail;
  }

  getInitials(): string {
    const displayName = this.getDisplayName();
    return displayName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('');
  }

  openProfile() {
  this.showUserMenu = false;
  this.toast.info('Tính năng đang phát triển');
  }

  // Accessibility: handle keydown for dropdown items
  onDropdownItemKeydown(event: KeyboardEvent, action: () => void) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }

  // Accessibility: handle keydown on user info for dropdown
  onUserInfoKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleUserMenu();
    }
  }

  // Accessibility: handle keydown on modal backdrop
  onBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter') {
      this.closeLoginForm();
    }
  }

  // Accessibility: handle keydown on dropdown overlay
  onDropdownOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter') {
      this.showUserMenu = false;
      event.preventDefault();
    }
  }

  // Helper methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Removed legacy DOM notification implementation in favor of ToastService
}