import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe } from '@angular/common';

import { Subject, BehaviorSubject } from 'rxjs';

export interface LoadingState {
  isLoading: boolean;
  operation?: string;
  progress?: number;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
  timestamp?: Date;
}

@Component({
  selector: 'app-loading-error-handler',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Loading Overlay -->
    @if (loadingState.isLoading) {
      <div class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner-container">
            <div class="loading-spinner"></div>
            @if (loadingState.progress !== undefined) {
              <div class="loading-progress">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    [style.width.%]="loadingState.progress">
                  </div>
                </div>
                <span class="progress-text">{{loadingState.progress}}%</span>
              </div>
            }
          </div>
          <p class="loading-message">
            {{loadingState.operation || 'Đang tải...'}}
          </p>
        </div>
      </div>
    }
    
    <!-- Error Notification -->
    @if (errorState.hasError) {
      <div
        class="error-notification"
        [class.error-slide-in]="errorState.hasError">
        <div class="error-content">
          <div class="error-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="error-details">
            <h4 class="error-title">Có lỗi xảy ra</h4>
            <p class="error-message">{{errorState.message || 'Đã xảy ra lỗi không xác định'}}</p>
            @if (errorState.code) {
              <small class="error-code">
                Mã lỗi: {{errorState.code}}
              </small>
            }
          </div>
          <div class="error-actions">
            <button
              class="btn btn-sm btn-outline-danger"
              (click)="dismissError()">
              <i class="fas fa-times"></i>
            </button>
            @if (showRetry) {
              <button
                class="btn btn-sm btn-primary"
                (click)="retryOperation()"
                >
                <i class="fas fa-redo"></i>
                Thử lại
              </button>
            }
          </div>
        </div>
      </div>
    }
    
    <!-- Success Notification -->
    @if (successMessage) {
      <div
        class="success-notification"
        [class.success-slide-in]="successMessage">
        <div class="success-content">
          <div class="success-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="success-message">
            {{successMessage}}
          </div>
          <button
            class="btn btn-sm btn-outline-success"
            (click)="dismissSuccess()">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    }
    
    <!-- Connection Status -->
    @if (!isOnline) {
      <div
        class="connection-status offline">
        <i class="fas fa-wifi"></i>
        Mất kết nối internet - Đang sử dụng dữ liệu offline
      </div>
    }
    `,
  styles: [`
    /* Loading Overlay */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    }

    .loading-content {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      text-align: center;
      max-width: 300px;
      min-width: 250px;
    }

    .loading-spinner-container {
      margin-bottom: 20px;
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e9ecef;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    .loading-progress {
      margin-top: 16px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(135deg, #007bff, #00c6ff);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px;
      color: #6c757d;
      font-weight: 600;
    }

    .loading-message {
      margin: 0;
      color: #495057;
      font-weight: 500;
    }

    /* Error Notification */
    .error-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border: 1px solid #f5c6cb;
      border-left: 4px solid #dc3545;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.15);
      max-width: 400px;
      z-index: 9998;
      overflow: hidden;
    }

    .error-slide-in {
      animation: slideInRight 0.3s ease;
    }

    .error-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
    }

    .error-icon {
      color: #dc3545;
      font-size: 20px;
      margin-top: 2px;
    }

    .error-details {
      flex: 1;
    }

    .error-title {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: #721c24;
    }

    .error-message {
      margin: 0 0 4px 0;
      font-size: 13px;
      color: #721c24;
      line-height: 1.4;
    }

    .error-code {
      font-size: 11px;
      color: #856404;
      font-family: monospace;
    }

    .error-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-sm {
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 4px;
    }

    .btn-outline-danger {
      color: #dc3545;
      border: 1px solid #dc3545;
      background: transparent;
    }

    .btn-outline-danger:hover {
      background: #dc3545;
      color: white;
    }

    .btn-primary {
      background: #007bff;
      color: white;
      border: none;
    }

    .btn-primary:hover {
      background: #0056b3;
    }

    /* Success Notification */
    .success-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-left: 4px solid #28a745;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.15);
      max-width: 400px;
      z-index: 9998;
    }

    .success-slide-in {
      animation: slideInRight 0.3s ease;
    }

    .success-content {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
    }

    .success-icon {
      color: #28a745;
      font-size: 18px;
    }

    .success-message {
      flex: 1;
      color: #155724;
      font-size: 14px;
      font-weight: 500;
    }

    .btn-outline-success {
      color: #28a745;
      border: 1px solid #28a745;
      background: transparent;
    }

    .btn-outline-success:hover {
      background: #28a745;
      color: white;
    }

    /* Connection Status */
    .connection-status {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      z-index: 9997;
      animation: slideInUp 0.3s ease;
    }

    .connection-status.offline {
      background: #ffc107;
      color: #212529;
      box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(100%);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .error-notification,
      .success-notification {
        left: 10px;
        right: 10px;
        max-width: none;
      }

      .loading-content {
        margin: 0 20px;
        min-width: auto;
        max-width: 280px;
      }

      .connection-status {
        left: 10px;
        right: 10px;
        transform: none;
        text-align: center;
      }
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .loading-content {
        background: #2d3748;
        color: white;
      }

      .loading-spinner {
        border-color: #4a5568;
        border-top-color: #63b3ed;
      }
    }
  `]
})
export class LoadingErrorHandlerComponent implements OnInit, OnDestroy {
  @Input() loadingState: LoadingState = { isLoading: false };
  @Input() errorState: ErrorState = { hasError: false };
  @Input() successMessage = '';
  @Input() showRetry = true;
  @Input() isOnline = true;

  @Output() retry = new EventEmitter<void>();
  @Output() errorDismissed = new EventEmitter<void>();
  @Output() successDismissed = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private successTimer?: number;

  ngOnInit() {
    // Auto dismiss success messages after 5 seconds
    if (this.successMessage) {
      this.successTimer = window.setTimeout(() => {
        this.dismissSuccess();
      }, 5000);
    }

    // Monitor online status
    this.monitorConnectionStatus();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
  }

  dismissError() {
    this.errorDismissed.emit();
  }

  dismissSuccess() {
    this.successDismissed.emit();
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
  }

  retryOperation() {
    this.retry.emit();
  }

  private monitorConnectionStatus() {
    if (typeof window !== 'undefined') {
      // Initial status
      this.isOnline = navigator.onLine;

      // Listen for connection changes
      window.addEventListener('online', () => {
        this.isOnline = true;
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }
}

// Service for managing global loading and error states
@Component({
  selector: 'app-global-state-manager',
  standalone: true,
  imports: [LoadingErrorHandlerComponent, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-loading-error-handler
      [loadingState]="loadingState$ | async"
      [errorState]="errorState$ | async" 
      [successMessage]="successMessage$ | async"
      [isOnline]="isOnline$ | async"
      (retry)="handleRetry()"
      (errorDismissed)="dismissError()"
      (successDismissed)="dismissSuccess()">
    </app-loading-error-handler>
  `
})
export class GlobalStateManagerComponent {
  private loadingSubject = new BehaviorSubject<LoadingState>({ isLoading: false });
  private errorSubject = new BehaviorSubject<ErrorState>({ hasError: false });
  private successSubject = new BehaviorSubject<string>('');
  private onlineSubject = new BehaviorSubject<boolean>(true);

  public loadingState$ = this.loadingSubject.asObservable();
  public errorState$ = this.errorSubject.asObservable();
  public successMessage$ = this.successSubject.asObservable();
  public isOnline$ = this.onlineSubject.asObservable();

  private lastOperation?: () => Promise<void>;

  setLoading(isLoading: boolean, operation?: string, progress?: number) {
    this.loadingSubject.next({
      isLoading,
      operation,
      progress
    });
  }

  setError(message: string, code?: string) {
    this.errorSubject.next({
      hasError: true,
      message,
      code,
      timestamp: new Date()
    });
  }

  setSuccess(message: string) {
    this.successSubject.next(message);
  }

  dismissError() {
    this.errorSubject.next({ hasError: false });
  }

  dismissSuccess() {
    this.successSubject.next('');
  }

  setLastOperation(operation: () => Promise<void>) {
    this.lastOperation = operation;
  }

  async handleRetry() {
    if (this.lastOperation) {
      this.dismissError();
      try {
        await this.lastOperation();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Retry failed';
        this.setError(message);
      }
    }
  }

  setOnlineStatus(isOnline: boolean) {
    this.onlineSubject.next(isOnline);
  }
}