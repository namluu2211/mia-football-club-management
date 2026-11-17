import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';
import { NAV_LINKS, NavLink } from './navigation-links';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule],
  template: `
    <footer class="app-footer">
      <div class="footer-container">
        <div class="footer-content">
          <!-- Logo and Brand -->
          <div class="footer-brand">
            <div class="footer-logo">
              <i class="fas fa-futbol"></i>
              <span class="logo-text">ThangLong FC</span>
            </div>
            <p class="brand-description">
              Mia Football Club Management System
            </p>
          </div>
    
          <!-- Quick Links -->
          <div class="footer-links">
            <h4>Liên kết nhanh</h4>
            <ul>
              @for (link of navLinks; track link) {
                <li>
                  <a [routerLink]="link.path" routerLinkActive="active" [routerLinkActiveOptions]="link.exact ? { exact: true } : {}">
                    @if (link.icon) {
                      <i [class]="link.icon" class="me-1"></i>
                    }
                    {{ link.label }}
                  </a>
                </li>
              }
            </ul>
          </div>
    
          <!-- Contact Info -->
          <div class="footer-contact">
            <h4>Liên hệ</h4>
            <div class="contact-item">
              <i class="fas fa-envelope"></i>
              <span>bktientu@gmail.com</span>
            </div>
            <div class="contact-item">
              <i class="fab fa-phone"></i>
              +84.913.933.835
            </div>
          </div>
    
          <!-- Tech Stack -->
          <div class="footer-tech">
            <h4>Công nghệ</h4>
            <div class="tech-stack">
              <span class="tech-item">Angular 20</span>
              <span class="tech-item">Firebase</span>
              <span class="tech-item">TypeScript</span>
            </div>
          </div>
        </div>
    
        <!-- Copyright Bar -->
        <div class="footer-bottom">
          <div class="copyright">
            <p>
              © 2025 <strong>Nam Luu</strong>. All rights reserved.
              <span class="divider">|</span>
              Made with <i class="fas fa-heart"></i> for ThangLong FC
            </p>
          </div>
          <div class="footer-version">
            <span>v{{ getVersion() }}</span>
            <span class="divider">|</span>
            <span>Build {{ getBuildDate() }}</span>
          </div>
        </div>
      </div>
    </footer>
    `,
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  navLinks: NavLink[] = NAV_LINKS;
  getVersion(): string {
    return '1.0.0';
  }

  getBuildDate(): string {
    return new Date().toLocaleDateString('vi-VN');
  }
}