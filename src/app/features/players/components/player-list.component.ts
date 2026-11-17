import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';

import { AvatarFallbackDirective } from '../directives/avatar-fallback.directive';
import { PlayerSkeletonComponent } from './player-skeleton.component';
import { FormsModule } from '@angular/forms';
import { Player } from '../player-utils';

@Component({
  selector: 'app-player-list',
  standalone: true,
  imports: [FormsModule, AvatarFallbackDirective, PlayerSkeletonComponent],
  template: `
  <div class="player-list-section">
    @if (showPlayerList) {
      <div class="player-list-card light">
        <div class="list-header">
          <h3><i class="fas fa-users me-2"></i>Danh sách cầu thủ</h3>
          <div class="list-controls">
            <button type="button" class="collapse-btn" (click)="toggleList.emit()" [attr.aria-expanded]="showPlayerList" title="Thu gọn danh sách">
              <i class="fas fa-chevron-up"></i>
            </button>
          </div>
        </div>
        @if (loading && paginatedPlayers.length === 0) {
          <app-player-skeleton></app-player-skeleton>
        }
        @if (paginatedPlayers.length && registeredPlayers.length) {
          <div class="legend-row">
            <span class="legend-item"><span class="legend-dot reg"></span> Đã đăng ký</span>
            <span class="legend-item"><span class="legend-dot unreg"></span> Chưa đăng ký</span>
          </div>
        }
        @if (paginatedPlayers.length > 0 && !loading) {
          <div class="players-grid4" aria-label="Danh sách cầu thủ phân trang">
            @for (player of paginatedPlayers; track trackByPlayerId($index, player)) {
              <div class="player-cell" [class.registered]="isRegistered(player)" [attr.aria-label]="player.firstName + (isRegistered(player)? ' đã đăng ký':' chưa đăng ký')">
                <div class="top-row">
                  <div class="avatar-small" (click)="viewPlayer.emit(player)" tabindex="0" (keyup)="onPlayerInfoKey($event, player)">
                    <img appAvatarFallback [fallbackSrc]="'assets/images/default-avatar.svg'" [src]="player.avatar || 'assets/images/default-avatar.svg'" [alt]="player.firstName" loading="lazy">
                  </div>
                  <!-- Allow viewers to mark registered for team shuffle; keep styling identical -->
                  <button class="register-toggle" (click)="toggleRegistration.emit(player)" [attr.aria-pressed]="isRegistered(player)" [title]="isRegistered(player)?'Hủy đăng ký':'Đăng ký'">
                    <i class="fas" [class.fa-circle-plus]="!isRegistered(player)" [class.fa-circle-check]="isRegistered(player)"></i>
                  </button>
                </div>
                <div class="info">
                  <div class="name" [title]="player.firstName + ' ' + player.lastName">{{ player.firstName }} {{ player.lastName }}</div>
                  <div class="position">{{ player.position }}</div>
                  @if (isRegistered(player)) {
                    <div class="reg-badge" aria-label="Đã đăng ký">Đăng ký</div>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty">
            <i class="fas fa-exclamation-triangle icon"></i>
            <h4>Không có dữ liệu cầu thủ</h4>
            <p>Đang tải hoặc có lỗi khi tải danh sách cầu thủ.</p>
            <button class="modern-btn btn-primary" (click)="reload.emit()">Thử tải lại</button>
          </div>
        }
        @if (totalPages > 1) {
          <div class="pagination-controls">
            <button class="btn btn-sm btn-outline-primary" [disabled]="currentPage === 0" (click)="previousPage.emit()" title="Trang trước">
              <i class="fas fa-chevron-left"></i>
            </button>
            <span class="pagination-info mx-3">Trang {{ currentPage + 1 }} / {{ totalPages }}</span>
            <button class="btn btn-sm btn-outline-primary" [disabled]="currentPage >= totalPages - 1" (click)="nextPage.emit()" title="Trang sau">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        }
      </div>
    } @else {
      <div class="collapsed-bar" aria-label="Danh sách cầu thủ đã thu gọn">
        <button type="button" class="expand-btn" (click)="toggleList.emit()" [attr.aria-expanded]="showPlayerList" title="Mở rộng danh sách">
          <i class="fas fa-chevron-down"></i> Hiện danh sách cầu thủ
        </button>
      </div>
    }
  </div>
  `,
  styles: [`
    .player-list-section { padding:12px 6px 8px; }
    .player-list-card.light { background:#f6f4ff; border:1px solid #e0dcf5; border-radius:16px; padding:14px 14px 10px; box-shadow:0 6px 20px -6px rgba(50,30,90,.25),0 2px 6px rgba(0,0,0,.08); }
    .list-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .list-header h3 { margin:0; font-size:1rem; font-weight:600; color:#312b53; letter-spacing:.3px; }
  .list-controls { display:flex; gap:6px; }
  .collapse-btn, .expand-btn { background:#ece8fa; border:1px solid #d3cbed; color:#5a3fd0; padding:6px 10px; font-size:.65rem; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600; }
  .collapse-btn:hover, .expand-btn:hover { background:#ded7f4; }
  .collapsed-bar { background:#f6f4ff; border:1px solid #e0dcf5; border-radius:14px; padding:10px 14px; display:flex; justify-content:center; box-shadow:0 4px 12px -4px rgba(50,30,90,.25); }
  .players-grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .player-cell { background:#ffffff; border:1px solid #dad4ed; border-radius:14px; padding:8px 8px 6px; display:flex; flex-direction:column; gap:4px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,.05); transition:box-shadow .18s, transform .18s, border-color .25s; }
  .player-cell.registered { border-color:#2e9b43; box-shadow:0 4px 14px -2px rgba(36,130,60,.28); background:linear-gradient(145deg,#ffffff,#f3fff6); }
  .player-cell:hover { box-shadow:0 6px 16px rgba(0,0,0,.15); transform:translateY(-3px); }
  .legend-row { display:flex; gap:18px; align-items:center; font-size:.6rem; margin:2px 2px 8px; padding:4px 6px; background:#efeafc; border:1px solid #ded3f9; border-radius:10px; width:fit-content; box-shadow:0 2px 4px rgba(50,30,90,.12); }
  .legend-item { display:flex; align-items:center; gap:4px; font-weight:500; color:#504672; }
  .legend-dot { width:12px; height:12px; border-radius:50%; display:inline-block; background:#d0c7ec; border:1px solid #b7add7; }
  .legend-dot.reg { background:#2e9b43; border-color:#237b35; }
  .legend-dot.unreg { background:#b7b2cc; }
  .top-row { display:flex; align-items:center; justify-content:space-between; gap:6px; }
    .register-toggle { background:#ece8fa; border:1px solid #d3cbed; color:#5a3fd0; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; font-size:14px; transition:background .18s, color .18s; }
    .player-row.registered .register-toggle { background:#36a14a; border-color:#2d8a3d; color:#fff; }
    .register-toggle:hover { background:#ded7f4; }
    .player-row.registered .register-toggle:hover { background:#42b156; }
    .register-toggle:focus-visible { outline:2px solid #ffcf66; outline-offset:2px; }
  .avatar-small { width:42px; height:42px; border-radius:50%; overflow:hidden; border:2px solid #d3cbed; background:#fff; display:flex; align-items:center; justify-content:center; position:relative; }
  /* Removed animated ring highlight for registered players */
    .avatar-small img { width:100%; height:100%; object-fit:cover; }
    .info { display:flex; flex-direction:column; line-height:1.15; }
    .name { font-weight:600; font-size:.8rem; color:#2c2350; letter-spacing:.2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .position { font-size:.6rem; text-transform:uppercase; letter-spacing:.5px; color:#6e6a85; }
  .reg-badge { margin-top:2px; font-size:.5rem; background:#2e9b43; color:#fff; padding:2px 6px; border-radius:12px; letter-spacing:.5px; font-weight:600; box-shadow:0 2px 4px rgba(0,0,0,.15); }
  @keyframes spin { to { transform:rotate(360deg); } }
    .pagination-controls { display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0 4px; }
    .empty { text-align:center; padding:32px 20px; background:#faf9fe; border:1px dashed #d8d1f4; border-radius:14px; color:#695f90; }
    .empty .icon { font-size:2.4rem; margin-bottom:12px; opacity:.65; }
  @media (max-width:900px){ .players-grid4 { grid-template-columns:repeat(3,1fr); } }
  @media (max-width:680px){ .players-grid4 { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:460px){
    .player-list-section { padding:6px 0 4px; }
    .player-list-card.light { padding:10px 8px 8px; }
    /* the page already shows a "Danh sách cầu thủ" heading with its own collapse button */
    .list-header { display:none; }
    .players-grid4 { gap:8px; }
    .player-cell { padding:8px 8px 8px; }
    .register-toggle { width:36px; height:36px; font-size:16px; }
    .name { font-size:.85rem; }
    .position { font-size:.68rem; }
    .reg-badge { font-size:.62rem; padding:2px 8px; align-self:flex-start; }
    .legend-row { font-size:.7rem; }
    .pagination-controls .btn { min-width:44px; min-height:44px; }
  }
  @media (max-width:330px){ .players-grid4 { grid-template-columns:1fr; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerListComponent {
  @Input() showPlayerList = true;
  @Input() paginatedPlayers: Player[] = [];
  @Input() displayPlayers: Player[] = [];
  @Input() pageSize = 20;
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Input() registeredPlayers: Player[] = [];
  @Input() loading = false;
  @Input() canEdit = false; // gate interactive controls
  @Output() toggleRegistration = new EventEmitter<Player>();
  @Output() previousPage = new EventEmitter<void>();
  @Output() nextPage = new EventEmitter<void>();
  @Output() savePlayers = new EventEmitter<void>();
  @Output() viewPlayer = new EventEmitter<Player>();
  @Output() toggleList = new EventEmitter<void>();
  @Output() reload = new EventEmitter<void>();
  @Output() editPlayer = new EventEmitter<Player>();
  @Output() deletePlayer = new EventEmitter<Player>();

  trackByPlayerId = (_:number, p:Player) => p.id;
  isRegistered = (p:Player) => this.registeredPlayers.some(r=>r.id===p.id);
  get paginationStart(){ return (this.currentPage*this.pageSize)+1; }
  get paginationEnd(){ return Math.min((this.currentPage+1)*this.pageSize, this.displayPlayers.length); }
  onPlayerInfoKey(event:KeyboardEvent, player:Player){ if(event.key==='Enter' || event.key===' ') this.viewPlayer.emit(player); }
  // Avatar fallback now handled by directive
  onAvatarError(){ /* deprecated: handled by directive */ }

  // Edit functionality removed; player modifications handled in Danh sách tab.
}
