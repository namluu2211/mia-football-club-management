import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-readonly-banner',
  standalone: true,
  imports: [],
  template: `
    @if (!canEdit) {
      <div class="readonly-banner" role="note" aria-label="Viewer mode active">
        <span class="icon">👁️</span>
        <span class="text">Chế độ xem: Đăng nhập tài khoản quản trị để chỉnh sửa dữ liệu.</span>
      </div>
    }
    `,
  styles: [`
    .readonly-banner { display:flex; align-items:center; gap:8px; background:linear-gradient(90deg,#f8f9fa,#eef2f7); border:1px solid #d0d7e2; padding:10px 14px; border-radius:10px; font-size:.85rem; color:#445266; margin:8px 0 16px; box-shadow:0 2px 4px rgba(0,0,0,.05); }
    .icon { font-size:1.1rem; }
    .text { font-weight:500; }
  `]
})
export class ReadonlyBannerComponent { @Input() canEdit=false; }
