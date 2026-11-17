import { Component, Input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show) {
      <div class="loading-overlay" role="status" aria-live="polite" aria-label="Đang tải dữ liệu">
        <div class="spinner"></div>
        <div class="message">Đang tải dữ liệu...</div>
      </div>
    }
    `,
  styles: [`
    .loading-overlay { position: fixed; inset: 0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(15,23,42,0.55); backdrop-filter:blur(6px); z-index:2000; }
    .spinner { width:64px; height:64px; border-radius:50%; border:6px solid rgba(255,255,255,0.15); border-top-color:#3b82f6; animation: spin 1s linear infinite; box-shadow:0 0 0 4px rgba(255,255,255,0.05); }
    @keyframes spin { to { transform:rotate(360deg); } }
    .message { margin-top:16px; font-size:14px; font-weight:600; color:#f8fafc; letter-spacing:.5px; text-shadow:0 2px 4px rgba(0,0,0,.4); }
  `]
})
export class LoadingOverlayComponent {
  @Input() show = false;
}