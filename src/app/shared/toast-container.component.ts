import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-wrapper" aria-live="polite" aria-atomic="true">
      @for (msg of messages(); track trackById($index, msg)) {
        <div class="toast" [class]="'toast ' + msg.type" role="alert">
          <div class="icon" aria-hidden="true">
          <i [ngClass]="{
            'fas fa-check-circle': msg.type==='success',
            'fas fa-exclamation-circle': msg.type==='error',
            'fas fa-info-circle': msg.type==='info',
            'fas fa-exclamation-triangle': msg.type==='warning'
          }"></i>
          </div>
          <div class="text">{{msg.text}}</div>
          <button type="button" class="close" (click)="dismiss(msg.id)" aria-label="Đóng thông báo">×</button>
        </div>
      }
    </div>
    `,
  styles: [`
    .toast-wrapper { position: fixed; top: 16px; right: 16px; display:flex; flex-direction:column; gap:12px; z-index:3000; }
    .toast { display:flex; align-items:flex-start; gap:10px; min-width:240px; max-width:360px; padding:12px 16px; border-radius:12px; box-shadow:0 8px 20px -4px rgba(0,0,0,.25); font-size:13px; font-weight:500; line-height:1.3; backdrop-filter:blur(14px) saturate(160%); position:relative; overflow:hidden; animation: slideToast .4s cubic-bezier(.4,0,.2,1); }
    @keyframes slideToast { from { opacity:0; transform:translateY(-12px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
    .toast.success { background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; }
    .toast.error { background:linear-gradient(135deg,#dc2626,#ef4444); color:#fff; }
    .toast.info { background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; }
    .toast.warning { background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; }
    .toast .icon { font-size:18px; margin-top:2px; }
    .toast .text { flex:1; }
    .toast .close { background:rgba(255,255,255,0.2); border:none; width:28px; height:28px; border-radius:50%; cursor:pointer; color:#fff; font-size:16px; display:flex; align-items:center; justify-content:center; font-weight:600; transition:background .25s; }
    .toast .close:hover { background:rgba(255,255,255,0.35); }
  `]
})
export class ToastContainerComponent {
  private readonly toastService = inject(ToastService);
  messages = () => this.toastService['messagesSubject'].value; // direct access for OnPush quick read
  trackById = (_:number, m:{id:string}) => m.id;
  dismiss(id:string){ this.toastService.dismiss(id); }
}
