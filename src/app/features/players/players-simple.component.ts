import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, debounceTime, takeUntil } from 'rxjs';

import { PlayerService } from '../../core/services/player.service';
import { AvatarUploadService } from './services/avatar-upload.service';
import { ToastService } from '../../core/services/toast.service';
import { PlayerInfo, PlayerStatus } from '../../core/models/player.model';
import { PerformanceService } from '../../services/performance.service';
import { AssetOptimizationService } from '../../services/asset-optimization.service';

@Component({
  selector: 'app-players-simple',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="players-container">
      <!-- Header Section -->
      <div class="header-section">
        <div class="title-text">
          <h1>Thông tin cầu thủ</h1>
          <p>Quản lý và theo dõi thông tin chi tiết của tất cả cầu thủ</p>
        </div>
        
        <!-- Removed header stats (Tổng cầu thủ, Cầu thủ xuất sắc, Cập nhật lần cuối) as requested -->

        <!-- Action Section -->
        <div class="actions-section">
          <h3 class="section-title">
            <i class="fas fa-tools"></i>
            Thao tác
          </h3>
          
          <div class="action-cards">
            <button 
              (click)="openCreatePlayerModal()" 
              class="action-card add-player">
              <div class="action-icon">
                <i class="fas fa-user-plus"></i>
              </div>
              <div class="action-content">
                <h4>Thêm cầu thủ</h4>
                <p>Tạo hồ sơ cầu thủ mới</p>
              </div>
            </button>

            <button 
              (click)="testLoadPlayers()" 
              class="action-card reload-data">
              <div class="action-icon">
                <i class="fas fa-sync-alt"></i>
              </div>
              <div class="action-content">
                <h4>Đồng bộ Firebase</h4>
                <p>Tải dữ liệu mới nhất</p>
              </div>
            </button>

            <button 
              (click)="exportPlayerStats()" 
              class="action-card export-data">
              <div class="action-icon">
                <i class="fas fa-file-export"></i>
              </div>
              <div class="action-content">
                <h4>Xuất dữ liệu</h4>
                <p>Tải thống kê cầu thủ</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading players data...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage && !isLoading" class="error-state">
        <div class="error-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Có lỗi xảy ra</h3>
        <p>{{ errorMessage }}</p>
        <button (click)="testLoadPlayers()" class="retry-btn">
          <i class="fas fa-redo"></i>
          Thử lại
        </button>
      </div>

      <!-- Filters Section -->
      <div *ngIf="!isLoading && !errorMessage" class="filters-section">
        <div class="search-container">
          <div class="search-box">
            <i class="fas fa-search search-icon"></i>
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên, vị trí..." 
              (input)="onSearchInput($event)"
              class="search-input"
              aria-label="Tìm kiếm cầu thủ">
            <span class="search-hint" *ngIf="filteredPlayers.length > 0">
              <i class="fas fa-users"></i> {{ filteredPlayers.length }} cầu thủ
            </span>
          </div>
          
          <div class="filter-group">
            <span class="filter-label">
              <i class="fas fa-filter"></i> Vị trí
            </span>
            <select (change)="onPositionFilterChange($event)" class="filter-select" aria-label="Lọc theo vị trí">
              <option value="">Tất cả vị trí</option>
              <option *ngFor="let position of availablePositions; trackBy: trackByPositionName" [value]="position">
                {{ position }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Players Table -->
      <div *ngIf="!isLoading && !errorMessage && filteredPlayers.length > 0" class="table-container">
        <div class="table-header-info">
          <h3 class="table-title">
            <i class="fas fa-table"></i>
            Danh sách cầu thủ
          </h3>
          <div class="table-meta">
            Hiển thị {{ pageStart + 1 }} - {{ pageEnd }} / {{ filteredPlayers.length }} cầu thủ
          </div>
        </div>
        <div class="table-wrapper">
          <table class="players-table">
            <thead>
              <tr>
                <th class="th-avatar">
                  <i class="fas fa-image"></i>
                </th>
                <th class="th-name">
                  <i class="fas fa-user"></i> Tên cầu thủ
                </th>
                <th class="th-position">
                  <i class="fas fa-map-marker-alt"></i> Vị trí
                </th>
                <th class="th-age">
                  <i class="fas fa-birthday-cake"></i> Tuổi
                </th>
                <th class="th-height">
                  <i class="fas fa-ruler-vertical"></i> Cao
                </th>
                <th class="th-weight">
                  <i class="fas fa-weight"></i> Nặng
                </th>
                <th class="th-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let player of paginatedPlayers; let i = index; trackBy: trackByPlayerId" 
                  class="player-row"
                  [class.row-even]="i % 2 === 0"
                  [class.row-odd]="i % 2 === 1">
                <td class="avatar-cell">
                  <div class="avatar-wrapper">
                    <img 
                      [src]="getPlayerAvatar(player)" 
                      [alt]="getPlayerDisplayName(player)"
                      class="player-avatar"
                      loading="lazy">
                    <div class="avatar-overlay">
                      <i class="fas fa-search-plus"></i>
                    </div>
                  </div>
                </td>
                <td class="name-cell">
                  <div class="player-name-container">
                    <div class="player-name">{{ getPlayerDisplayName(player) }}</div>
                    <div class="player-subtitle" *ngIf="player.stats?.totalMatches">
                      <i class="fas fa-futbol"></i> {{ player.stats.totalMatches }} trận
                    </div>
                  </div>
                </td>
                <td class="position-cell">
                  <span class="position-badge" [class.position-gk]="player.position?.includes('Thủ môn')"
                        [class.position-def]="player.position?.includes('Hậu vệ')"
                        [class.position-mid]="player.position?.includes('Tiền vệ')"
                        [class.position-fwd]="player.position?.includes('Tiền đạo')">
                    {{ player.position }}
                  </span>
                </td>
                <td class="age-cell">
                  <span class="data-value">{{ calculateAge(player) }}</span>
                </td>
                <td class="height-cell">
                  <span class="data-value">{{ player.height }}<small>cm</small></span>
                </td>
                <td class="weight-cell">
                  <span class="data-value">{{ player.weight }}<small>kg</small></span>
                </td>
                <td class="actions-cell">
                  <button 
                    (click)="viewPlayerDetails(player)" 
                    class="action-btn detail-btn"
                    title="Xem chi tiết cầu thủ">
                    <i class="fas fa-eye"></i>
                    <span class="btn-text">Chi tiết</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" *ngIf="totalPages > 1">
          <button class="page-btn page-nav" (click)="prevPage()" [disabled]="currentPage === 0" title="Trang trước">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="page-numbers">
            <ng-container *ngFor="let p of pages; let i = index; trackBy: trackByPageIndex">
              <button class="page-btn" 
                      [class.active]="i === currentPage" 
                      (click)="goToPage(i)"
                      [attr.aria-label]="'Trang ' + (i + 1)"
                      [attr.aria-current]="i === currentPage ? 'page' : null">
                {{ i + 1 }}
              </button>
            </ng-container>
          </div>
          <button class="page-btn page-nav" (click)="nextPage()" [disabled]="currentPage === totalPages - 1" title="Trang sau">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <!-- No Results State -->
      <div *ngIf="!isLoading && !errorMessage && filteredPlayers.length === 0" class="no-results">
        <div class="no-results-icon">
          <i class="fas fa-search"></i>
        </div>
        <h3>Không tìm thấy cầu thủ</h3>
        <p>Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
        <button (click)="clearFilters()" class="clear-filters-btn">
          <i class="fas fa-times-circle"></i>
          Xóa bộ lọc
        </button>
      </div>

      <!-- Detail / Create / Edit Panels -->
      <div 
        class="overlay" 
        *ngIf="panelOpen" 
        (click)="closePanels()" 
        tabindex="0" 
        role="presentation" 
        (keydown.escape)="closePanels()" 
        (keydown.enter)="closePanels()" 
        (keydown.space)="closePanels()"></div>

      <!-- Detail Panel -->
      <section *ngIf="isDetailOpen" class="side-panel animate-in" role="dialog" aria-modal="true" aria-label="Thông tin cầu thủ">
        <header class="panel-header">
          <h3>Thông tin cầu thủ</h3>
          <button class="icon-btn" (click)="closePanels()" aria-label="Đóng">✕</button>
        </header>
        <ng-container *ngIf="selectedPlayer; else noPlayer">
          <div class="panel-body">
            <div class="player-hero">
              <img class="hero-avatar" [src]="getPlayerAvatar(selectedPlayer)" [alt]="getPlayerDisplayName(selectedPlayer)" />
              <div class="hero-meta">
                <div class="hero-name">{{ getPlayerDisplayName(selectedPlayer) }}</div>
                <div class="hero-position">{{ selectedPlayer.position || 'Chưa xác định' }}</div>
              </div>
            </div>
            
            <!-- Video Section -->
            <div class="player-video-section" *ngIf="selectedPlayer?.videoUrl">
              <h4 class="video-label"><i class="fas fa-video me-2"></i>Video</h4>
              <div class="video-container">
                <iframe 
                  [src]="getVideoEmbedUrl(selectedPlayer?.videoUrl)" 
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowfullscreen
                  loading="lazy"
                  title="Video cầu thủ">
                </iframe>
              </div>
            </div>
            
            <!-- Video Placeholder when no video -->
            <div class="player-video-section video-placeholder" *ngIf="!selectedPlayer?.videoUrl">
              <div class="video-empty-state">
                <i class="fas fa-video video-icon"></i>
                <p class="video-message">Chưa có video</p>
                <p class="video-hint">Thêm video trong phần chỉnh sửa</p>
              </div>
            </div>
            
            <dl class="detail-list">
              <div><dt>Tuổi</dt><dd>{{ calculateAge(selectedPlayer) }}</dd></div>
              <div><dt>Chiều cao</dt><dd>{{ selectedPlayer.height || '—' }}cm</dd></div>
              <div><dt>Cân nặng</dt><dd>{{ selectedPlayer.weight || '—' }}kg</dd></div>
              <div *ngIf="selectedPlayer.notes" class="note-section"><dt>Ghi chú</dt><dd>{{ selectedPlayer.notes }}</dd></div>
            </dl>
          </div>
          <footer class="panel-footer">
            <button class="primary-btn" (click)="openEditPlayer(selectedPlayer)">Chỉnh sửa</button>
            <button class="danger-btn" (click)="deleteSelectedPlayer()">
              <i class="fas fa-trash-alt"></i> Xóa
            </button>
            <button class="ghost-btn" (click)="closePanels()">Đóng</button>
          </footer>
        </ng-container>
        <ng-template #noPlayer><p>Không có dữ liệu.</p></ng-template>
      </section>

      <!-- Create Panel -->
      <section *ngIf="isCreateOpen" class="side-panel animate-in" role="dialog" aria-modal="true" aria-label="Thêm cầu thủ">
        <header class="panel-header">
          <h3>Thêm cầu thủ</h3>
          <button class="icon-btn" (click)="closePanels()" aria-label="Đóng">✕</button>
        </header>
        <div class="panel-body">
          <form (ngSubmit)="submitCreate()" #createForm="ngForm" class="player-form" id="createPlayerForm">
            <div class="form-grid">
              <label><span>Tên *</span><input name="firstName" [(ngModel)]="createModel.firstName" required /></label>
              <label><span>Họ</span><input name="lastName" [(ngModel)]="createModel.lastName" /></label>
              <label><span>Ngày sinh</span><input type="date" name="dateOfBirth" [(ngModel)]="createModel.dateOfBirth" (change)="onCreateDobChange($event)" /></label>
              <label><span>Vị trí</span><input name="position" [(ngModel)]="createModel.position" /></label>
                <label><span>Chiều cao (cm)</span><input type="number" name="height" [(ngModel)]="createModel.height" (change)="onCreateHeightChange($event)" /></label>
                <label><span>Cân nặng (kg)</span><input type="number" name="weight" [(ngModel)]="createModel.weight" (change)="onCreateWeightChange($event)" /></label>
              <label><span>Avatar URL</span><input name="avatar" [(ngModel)]="createModel.avatar" maxlength="300" placeholder="https://..." /></label>
              <label><span>Video URL</span><input name="videoUrl" [(ngModel)]="createModel.videoUrl" maxlength="500" placeholder="YouTube, TikTok, Facebook, Instagram, Vimeo, Drive, OneDrive..." /></label>
              <label class="full"><span>Ghi chú</span><textarea name="notes" [(ngModel)]="createModel.notes" rows="2" maxlength="400" placeholder="Ghi chú nội bộ"></textarea></label>
              <label class="full"><span>Chọn ảnh (tùy chọn)</span><input type="file" accept="image/*" (change)="onCreateAvatarFileChange($event)" /></label>
            </div>
            <div class="avatar-preview" *ngIf="createModel.avatar">
              <img [src]="createModel.avatar" alt="avatar preview" (error)="createModel.avatar=''" />
            </div>
          </form>
        </div>
        <footer class="panel-footer">
          <div class="form-hint" *ngIf="!createModel.firstName" style="font-size:0.65rem; color:#d93025; flex:1;">Nhập tên để bật nút Lưu.</div>
          <button class="primary-btn" [disabled]="!createValid" type="submit" form="createPlayerForm">Lưu</button>
          <button class="ghost-btn" type="button" (click)="closePanels()">Hủy</button>
        </footer>
      </section>

      <!-- Edit Panel -->
      <section *ngIf="isEditOpen" class="side-panel animate-in" role="dialog" aria-modal="true" aria-label="Chỉnh sửa cầu thủ">
        <header class="panel-header">
          <h3>Chỉnh sửa cầu thủ</h3>
          <button class="icon-btn" (click)="closePanels()" aria-label="Đóng">✕</button>
        </header>
        <div class="panel-body" *ngIf="editModel">
          <form (ngSubmit)="submitEdit()" #editForm="ngForm" class="player-form" id="editPlayerForm">
            <div class="form-grid">
              <label><span>Tên *</span><input name="firstName" [(ngModel)]="editModel.firstName" required /></label>
              <label><span>Họ</span><input name="lastName" [(ngModel)]="editModel.lastName" /></label>
              <label><span>Ngày sinh</span><input type="date" name="dateOfBirth" [(ngModel)]="editModel.dateOfBirth" (change)="onEditDobChange($event)" /></label>
              <label><span>Vị trí</span><input name="position" [(ngModel)]="editModel.position" /></label>
              <label><span>Chiều cao (cm)</span><input type="number" name="height" [(ngModel)]="editModel.height" (change)="onEditHeightChange($event)" /></label>
              <label><span>Cân nặng (kg)</span><input type="number" name="weight" [(ngModel)]="editModel.weight" (change)="onEditWeightChange($event)" /></label>
              <label><span>Avatar URL</span><input name="avatar" [(ngModel)]="editModel.avatar" maxlength="300" placeholder="https://..." /></label>
              <label><span>Video URL</span><input name="videoUrl" [(ngModel)]="editModel.videoUrl" maxlength="500" placeholder="YouTube, TikTok, Facebook, Instagram, Vimeo, Drive, OneDrive..." /></label>
              <label class="full"><span>Ghi chú</span><textarea name="notes" [(ngModel)]="editModel.notes" rows="2" maxlength="400" placeholder="Ghi chú nội bộ"></textarea></label>
              <label class="full"><span>Chọn ảnh mới</span><input type="file" accept="image/*" (change)="onEditAvatarFileChange($event)" /></label>
            </div>
            <div class="avatar-preview" *ngIf="editModel.avatar">
              <img [src]="editModel.avatar" alt="avatar preview" (error)="editModel.avatar=''" />
            </div>
          </form>
        </div>
        <footer class="panel-footer">
          <button class="primary-btn" [disabled]="editForm?.invalid || !editValid" type="submit" form="editPlayerForm">Cập nhật</button>
          <button class="ghost-btn" type="button" (click)="closePanels()">Hủy</button>
        </footer>
      </section>

      <!-- No Results -->
      <div *ngIf="!isLoading && !errorMessage && filteredPlayers.length === 0 && allPlayers.length > 0" class="no-results">
        <div class="no-results-icon">
          <i class="fas fa-search"></i>
        </div>
        <h3>Không tìm thấy cầu thủ</h3>
        <p>Không có cầu thủ nào phù hợp với bộ lọc hiện tại.</p>
        <button (click)="clearFilters()" class="clear-filters-btn">
          <i class="fas fa-times"></i>
          Xóa bộ lọc
        </button>
      </div>
    </div>
  `,
  styles: [`
    .players-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .header-section {
      max-width: 1200px;
      margin: 0 auto 40px;
      text-align: center;
    }

    .title-text h1 {
      font-size: 2.8rem;
      margin: 0 0 10px 0;
      font-weight: 700;
      color: white;
    }

    .title-text p {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
    }

    .header-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 20px;
      max-width: 1000px;
      margin: 30px auto;
    }

    .quick-stat {
      background: rgba(255, 255, 255, 0.15);
      padding: 20px;
      border-radius: 15px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      gap: 15px;
      transition: transform 0.3s ease;
    }

    .quick-stat:hover {
      transform: translateY(-5px);
    }

    .stat-icon {
      font-size: 1.5rem;
      color: #fff;
    }

    .stat-number {
      font-size: 1.8rem;
      font-weight: bold;
      color: white;
    }

    .stat-label {
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.8);
    }

    .actions-section {
      margin: 30px auto;
      max-width: 800px;
    }

    .section-title {
      color: white;
      font-size: 1.5rem;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: center;
    }

    .action-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .action-card {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 15px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 15px;
      text-align: left;
    }

    .action-card:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-3px);
    }

    .action-icon {
      font-size: 2rem;
      color: #fff;
    }

    .action-content h4 {
      color: white;
      margin: 0 0 5px 0;
      font-size: 1.1rem;
    }

    .action-content p {
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
      font-size: 0.9rem;
    }

    .filters-section {
      max-width: 1200px;
      margin: 0 auto 30px;
      animation: slideDown 0.4s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .search-container {
      background: rgba(255, 255, 255, 0.15);
      padding: 24px;
      border-radius: 16px;
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 280px;
    }

    .search-input {
      width: 100%;
      padding: 14px 18px 14px 50px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 1rem;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15), 0 4px 12px rgba(0, 0, 0, 0.12);
      transform: translateY(-1px);
    }

    .search-icon {
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      color: #667eea;
      font-size: 1.1rem;
      transition: transform 0.3s ease;
    }

    .search-input:focus ~ .search-icon {
      transform: translateY(-50%) scale(1.1);
    }

    .search-hint {
      position: absolute;
      right: 18px;
      top: 50%;
      transform: translateY(-50%);
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
    }

    .filter-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .filter-label {
      color: white;
      font-weight: 600;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .filter-select {
      padding: 12px 18px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .filter-select:hover {
      border-color: #667eea;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .filter-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15);
    }

    .table-container {
      max-width: 1200px;
      margin: 0 auto 30px;
      background: rgba(255, 255, 255, 0.98);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
      animation: fadeInUp 0.5s ease;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .table-header-info {
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .table-title {
      margin: 0;
      color: white;
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .table-meta {
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.9rem;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.15);
      padding: 6px 14px;
      border-radius: 20px;
      backdrop-filter: blur(8px);
    }

    .table-wrapper {
      overflow-x: auto;
      max-height: 600px;
      overflow-y: auto;
    }

    .players-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }

    .players-table thead {
      position: sticky;
      top: 0;
      z-index: 10;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .players-table th {
      padding: 16px 18px;
      text-align: left;
      font-weight: 700;
      color: white;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 3px solid rgba(255, 255, 255, 0.3);
      white-space: nowrap;
    }

    .th-avatar {
      width: 70px;
      text-align: center !important;
    }

    .th-age, .th-height, .th-weight {
      text-align: center !important;
    }

    .player-row {
      transition: all 0.2s ease;
      position: relative;
    }

    .player-row:hover {
      background: linear-gradient(90deg, #f8f9ff 0%, #e8eeff 100%);
      transform: scale(1.01);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
      z-index: 5;
    }

    .row-even {
      background: #ffffff;
    }

    .row-odd {
      background: #f8f9fd;
    }

    .players-table td {
      padding: 16px 18px;
      border-bottom: 1px solid #e8ecf4;
      vertical-align: middle;
      font-size: 0.95rem;
    }

    .avatar-cell {
      width: 70px;
      text-align: center !important;
      vertical-align: middle !important;
      padding: 16px 0 !important;
    }

    .age-cell, .height-cell, .weight-cell {
      text-align: center !important;
    }

    .avatar-wrapper {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 50px;
      cursor: pointer;
      margin: 0 auto;
    }

    .player-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    }

    .avatar-wrapper:hover .player-avatar {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    .avatar-overlay {
      position: absolute;
      inset: 0;
      background: rgba(102, 126, 234, 0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      color: white;
      font-size: 1.1rem;
    }

    .avatar-wrapper:hover .avatar-overlay {
      opacity: 1;
    }

    .player-name-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .player-name {
      font-weight: 700;
      color: #2d3748;
      font-size: 1rem;
      letter-spacing: 0.3px;
    }

    .player-subtitle {
      font-size: 0.8rem;
      color: #718096;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .player-subtitle i {
      color: #667eea;
    }

    .position-badge {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      color: #1565c0;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 0.85rem;
      font-weight: 600;
      display: inline-block;
      box-shadow: 0 2px 6px rgba(21, 101, 192, 0.2);
      transition: all 0.2s ease;
    }

    .position-badge:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(21, 101, 192, 0.3);
    }

    .position-gk {
      background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%);
      color: #f57f17;
      box-shadow: 0 2px 6px rgba(245, 127, 23, 0.2);
    }

    .position-def {
      background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
      color: #2e7d32;
      box-shadow: 0 2px 6px rgba(46, 125, 50, 0.2);
    }

    .position-mid {
      background: linear-gradient(135deg, #e1bee7 0%, #ce93d8 100%);
      color: #6a1b9a;
      box-shadow: 0 2px 6px rgba(106, 27, 154, 0.2);
    }

    .position-fwd {
      background: linear-gradient(135deg, #ffccbc 0%, #ffab91 100%);
      color: #d84315;
      box-shadow: 0 2px 6px rgba(216, 67, 21, 0.2);
    }

    .data-value {
      font-weight: 600;
      color: #4a5568;
      font-size: 0.95rem;
    }

    .data-value small {
      font-weight: 400;
      color: #a0aec0;
      margin-left: 2px;
    }

    .action-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      white-space: nowrap;
    }

    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.45);
    }

    .action-btn:active {
      transform: translateY(0);
    }

    .btn-text {
      font-weight: 600;
    }

    @media (max-width: 768px) {
      .btn-text {
        display: none;
      }
      .action-btn {
        padding: 10px 14px;
      }
    }

    .pagination-bar {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: linear-gradient(180deg, #ffffff 0%, #f8f9fd 100%);
      border-top: 2px solid #e8ecf4;
      flex-wrap: wrap;
    }

    .page-numbers {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .page-btn {
      background: #ffffff;
      border: 2px solid #e8ecf4;
      min-width: 42px;
      height: 42px;
      padding: 0 12px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      color: #4a5568;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .page-btn:hover:not(:disabled):not(.active) {
      background: #f8f9ff;
      border-color: #667eea;
      color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(102, 126, 234, 0.2);
    }

    .page-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      background: #f1f3f5;
    }

    .page-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
      transform: scale(1.05);
    }

    .page-nav {
      font-weight: 700;
    }

    .page-nav i {
      font-size: 0.85rem;
    }

    .loading-state, .error-state, .no-results {
      text-align: center;
      padding: 80px 20px;
      color: white;
      max-width: 600px;
      margin: 0 auto;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255, 255, 255, 0.2);
      border-top: 5px solid white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 24px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-state p {
      font-size: 1.1rem;
      font-weight: 500;
      margin-top: 20px;
      color: rgba(255, 255, 255, 0.9);
    }

    .error-icon, .no-results-icon {
      font-size: 4rem;
      margin-bottom: 24px;
      color: rgba(255, 255, 255, 0.9);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.05);
      }
    }

    .error-state h3, .no-results h3 {
      font-size: 1.8rem;
      margin-bottom: 16px;
      font-weight: 700;
    }

    .error-state p, .no-results p {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.85);
      margin-bottom: 28px;
      line-height: 1.6;
    }

    .retry-btn, .clear-filters-btn {
      background: rgba(255, 255, 255, 0.25);
      border: 2px solid rgba(255, 255, 255, 0.4);
      color: white;
      padding: 14px 28px;
      border-radius: 30px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .retry-btn:hover, .clear-filters-btn:hover {
      background: rgba(255, 255, 255, 0.35);
      border-color: rgba(255, 255, 255, 0.6);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }

    .retry-btn:active, .clear-filters-btn:active {
      transform: translateY(0);
    }

    .pagination-bar {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 15px;
      flex-wrap: wrap;
    }

    .page-btn {
      background: #e0e7ff;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: background-color 0.2s ease;
    }

    .page-btn:hover:not(:disabled) {
      background: #c7d2fe;
    }

    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .page-btn.active {
      background: #667eea;
      color: #fff;
    }

    .page-info {
      margin-left: auto;
      font-size: 0.8rem;
      color: #555;
    }

    /* Panels / overlay */
  .overlay { position: fixed; inset:0; background: rgba(0,0,0,0.45); backdrop-filter: blur(2px); z-index: 80; animation: fadeIn .25s ease; }
    .side-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 380px;
      max-width: 92%;
      height: auto;
      max-height: 88vh;
      background: #fff;
      z-index: 90;
      padding: 0;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.24);
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }
  .animate-in { animation: slideIn .3s ease; }
  @keyframes slideIn { from { transform: translate(-50%, -50%) scale(0.94); opacity:0;} to { transform: translate(-50%, -50%) scale(1); opacity:1;} }
  @keyframes fadeIn { from { opacity:0;} to { opacity:1;} }
  .panel-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #eee; background:#fafbfd; border-radius:16px 16px 0 0; }
  .panel-header h3 { margin:0; font-size:1.15rem; font-weight:600; }
    .panel-body {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0;
    }
  .icon-btn { background:transparent; border:none; font-size:1.1rem; cursor:pointer; line-height:1; padding:4px 6px; border-radius:4px; }
  .icon-btn:hover { background:#f2f2f2; }
  .player-hero { display:flex; gap:14px; padding:20px 20px 12px; align-items:center; }
  .hero-avatar { width:70px; height:70px; border-radius:50%; object-fit:cover; background:#f3f3f3; box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.1); }
  .hero-meta { display:flex; flex-direction:column; justify-content:center; }
  .hero-name { font-weight:600; font-size:1.05rem; }
  .hero-position { font-size:0.75rem; text-transform:uppercase; letter-spacing:.5px; background:#eef2ff; color:#3845a7; padding:4px 8px; border-radius:12px; margin-top:6px; width:max-content; }
  
  /* Video Section */
  .player-video-section { padding:0 20px 16px; }
  .video-label { font-size:0.85rem; font-weight:600; color:#333; margin:0 0 12px; }
  .video-container { position:relative; width:100%; padding-bottom:56.25%; /* 16:9 aspect ratio */ border-radius:12px; overflow:hidden; background:#000; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
  .video-container iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:none; }
  .video-placeholder { margin-bottom:12px; }
  .video-empty-state { background:#f8f9fb; border:2px dashed #d1d5db; border-radius:12px; padding:32px 20px; text-align:center; }
  .video-icon { font-size:2.5rem; color:#9ca3af; margin-bottom:12px; }
  .video-message { font-size:0.95rem; font-weight:600; color:#4b5563; margin:0 0 4px; }
  .video-hint { font-size:0.75rem; color:#9ca3af; margin:0; }
  
  .mini-stats { display:flex; gap:10px; padding:0 20px 16px; }
  .mini-stat { background:#f8f9fb; padding:10px 14px; border-radius:10px; display:flex; flex-direction:column; align-items:center; flex:1; }
  .mini-stat span { font-weight:600; font-size:1rem; }
  .mini-stat .mini-label { font-size:0.65rem; text-transform:uppercase; letter-spacing:.5px; color:#555; }
  .detail-list { display:grid; grid-template-columns:1fr 1fr; gap:12px 16px; padding:8px 20px 20px; }
  .detail-list dt { font-size:0.65rem; text-transform:uppercase; letter-spacing:.5px; color:#666; margin:0 0 4px; }
  .detail-list dd { margin:0; font-size:0.88rem; font-weight:500; }
  .panel-footer { position:sticky; bottom:0; background:#fff; padding:16px 20px; display:flex; gap:12px; border-top:1px solid #eee; border-radius:0 0 16px 16px; }
  .primary-btn, .ghost-btn, .danger-btn, .icon-btn, .action-btn { font-family:inherit; }
  .primary-btn { background:#667eea; border:none; padding:11px 20px; color:#fff; border-radius:8px; font-size:0.85rem; font-weight:600; cursor:pointer; box-shadow:0 2px 6px rgba(102,126,234,0.35); flex:1; }
  .primary-btn:hover { background:#5a6fd6; }
  .primary-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .danger-btn { background:#dc3545; border:none; padding:11px 20px; color:#fff; border-radius:8px; font-size:0.85rem; font-weight:600; cursor:pointer; box-shadow:0 2px 6px rgba(220,53,69,0.35); flex:1; display:flex; align-items:center; justify-content:center; gap:6px; }
  .danger-btn:hover { background:#c82333; }
  .danger-btn:active { transform:scale(0.98); }
  .danger-btn i { font-size:0.8rem; }
  .ghost-btn { background:#f1f2f6; border:none; padding:11px 18px; border-radius:8px; font-size:0.8rem; cursor:pointer; flex:1; }
  .ghost-btn:hover { background:#e3e6ee; }
    .player-form {
      padding: 20px 20px 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .form-grid label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: .5px;
      text-transform: uppercase;
      color: #555;
    }
    .form-grid input {
      padding: 9px 11px;
      border: 1px solid #d4d8e3;
      border-radius: 6px;
      font-size: 0.85rem;
      width: 100%;
      box-sizing: border-box;
    }
    .form-grid input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102,126,234,0.25);
    }
    .form-grid label.full { grid-column:1 / -1; }
    .avatar-preview { margin:10px 4px 0; padding:8px; border:1px solid #e2e5ec; border-radius:10px; background:#f9fafc; display:flex; align-items:center; }
    .avatar-preview img { width:70px; height:70px; object-fit:cover; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.15); }
    .upload-progress { font-size:0.85rem; color:#1a73e8; margin:8px 4px; padding:6px 10px; background:#e8f0fe; border-radius:6px; }
    .upload-error { font-size:0.85rem; color:#d93025; margin:8px 4px; padding:6px 10px; background:#fce8e6; border-radius:6px; }
    .note-indicator { font-size:0.7rem; margin-top:4px; }
  /* debug-info removed */
  /* inline warnings removed; using toasts */
  @media (max-width:520px) { 
    .side-panel { width:90%; max-height:92vh; }
    .form-grid { grid-template-columns:1fr; }
  }

    @media (max-width: 768px) {
      .search-container {
        flex-direction: column;
        align-items: stretch;
      }
      
      .filter-group {
        justify-content: center;
      }
      
      .table-container {
        overflow-x: auto;
      }
      
      .action-cards {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PlayersSimpleComponent implements OnInit, OnDestroy {
  private readonly performanceService = inject(PerformanceService);
  private readonly assetService = inject(AssetOptimizationService);
  private readonly playerService = inject(PlayerService);
  private readonly avatarUploadService = inject(AvatarUploadService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();
  private componentLoadId: string | null = null;
  
  allPlayers: PlayerInfo[] = [];
  filteredPlayers: PlayerInfo[] = [];
  isLoading = false;
  errorMessage = '';
  lastUpdate?: Date;
  selectedPlayer: PlayerInfo | null = null;
  isDetailOpen = false;
  isCreateOpen = false;
  isEditOpen = false;
  createModel: Partial<PlayerInfo> = { firstName: '', lastName: '', position: '' };
  editModel: Partial<PlayerInfo> | null = null;
  uploadingCreate = false;
  uploadingEdit = false;
  uploadError = '';
  // Explicit validity override for create form (decoupled from template-driven form status)
  readonly minHeight = 140; // cm
  readonly maxHeight = 220; // cm
  readonly minWeight = 40;  // kg
  readonly maxWeight = 120; // kg
  get createValid(): boolean {
    return !!this.createModel.firstName?.trim() && this.isValidPhysical(this.createModel.height, this.createModel.weight);
  }
  get editValid(): boolean {
    return !!this.editModel?.firstName?.trim() && this.isValidPhysical(this.editModel?.height, this.editModel?.weight);
  }
  
  // Derived UI state
  get panelOpen(): boolean {
    return this.isDetailOpen || this.isCreateOpen || this.isEditOpen;
  }
  
  // Cache for expensive computations
  // (Removed average age & top players cache fields)
  
  // Filter state
  searchTerm = '';
  selectedPosition = '';
  availablePositions: string[] = [];

  // Pagination state
  readonly pageSize = 10;
  currentPage = 0;

  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredPlayers.length / this.pageSize)); }
  get paginatedPlayers(): PlayerInfo[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredPlayers.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.currentPage * this.pageSize; }
  get pageEnd(): number { return Math.min(this.filteredPlayers.length, this.pageStart + this.pageSize); }
  get pages(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i); }
  trackByPageIndex = (index: number) => index;
  
  trackByPlayerId = (index: number, player: PlayerInfo): string => {
    return (player.id || `${player.firstName}-${index}`) + ':' + (player.__rev || 0);
  };

  trackByPositionName = (index: number, position: string): string => {
    return position;
  };

  ngOnInit() {
    // Start performance monitoring for this component
    this.componentLoadId = this.performanceService.startComponentLoad('PlayersSimpleComponent');
    
    // Set up debounced search to reduce excessive filtering
    this.searchSubject$.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.applyFilters();
      this.cdr.markForCheck();
    });
    
    this.loadPlayersFromService();

    // Reactive subscription to player service for real-time updates
    this.playerService.players$.pipe(takeUntil(this.destroy$)).subscribe(players => {
      // Force immutability clone to help OnPush render updates
      this.allPlayers = players.map(p => ({ ...p }));
      this.processPlayersData();
      this.cdr.markForCheck();
    });
  }

  async testLoadPlayers() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      console.log('🔄 Refreshing players from Firebase...');
      
      // Force refresh from Firebase (bypasses localStorage cache)
      await this.playerService.refreshPlayers();
      
      // Get data from PlayerService instead of localStorage directly
      this.allPlayers = this.playerService.getAllPlayers();
      
      if (this.allPlayers && this.allPlayers.length > 0) {
        this.processPlayersData();
        
        console.log('✅ Players refreshed successfully:', this.allPlayers.length, 'players loaded');
        this.toast.success('Dữ liệu đã được cập nhật từ Firebase');
        
        // Complete performance monitoring after successful load
        if (this.componentLoadId) {
          this.performanceService.endComponentLoad(this.componentLoadId, 'PlayersSimpleComponent');
          this.componentLoadId = null;
        }
      } else {
        console.log('⚠️ No players in service, trying fallback...');
        await this.testFetchDirect();
        return;
      }
      
    } catch (error) {
      console.error('❌ Error refreshing players:', error);
      this.errorMessage = `Error loading players: ${error}`;
      this.toast.error('Không thể tải dữ liệu từ Firebase');
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async testFetchDirect() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      const response = await fetch('/assets/players.json');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      const data = JSON.parse(text);
      this.allPlayers = data;
      
      localStorage.setItem('players.json', text);
      
      this.processPlayersData();
      
    } catch (error) {
      console.error('Error fetching players:', error);
      this.errorMessage = `Fetch error: ${error}`;
    } finally {
      this.isLoading = false;
    }
  }

  processPlayersData() {
    this.lastUpdate = new Date();
    this.extractAvailablePositions();
    this.applyFilters();
    this.cdr.markForCheck();
  }

  extractAvailablePositions() {
    const positions = new Set(this.allPlayers.map(p => p.position).filter(p => p));
    this.availablePositions = Array.from(positions).sort();
  }

  applyFilters() {
    let filtered = [...this.allPlayers];

    // Text search filter
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(player => 
        player.firstName?.toLowerCase().includes(searchLower) ||
        player.lastName?.toLowerCase().includes(searchLower) ||
        player.position?.toLowerCase().includes(searchLower) ||
        player.id?.toString().includes(searchLower)
      );
    }

    // Position filter
    if (this.selectedPosition) {
      filtered = filtered.filter(player => player.position === this.selectedPosition);
    }

    this.filteredPlayers = filtered;
    this.currentPage = 0; // reset to first page when filters change
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchSubject$.next(target.value);
  }

  onPositionFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedPosition = target.value;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedPosition = '';
    this.applyFilters();
    this.cdr.markForCheck();
  }

  // Helper method to calculate age from PlayerInfo
  calculateAge(player: PlayerInfo): number {
    if (player.age) return player.age;
    
    if (!player.dateOfBirth) return 0;
    
    // Handle if DOB is a date string
    const birthDate = new Date(player.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  // Helper method to get player display name
  getPlayerDisplayName(player: PlayerInfo): string {
    return player.fullName || (player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName);
  }

  // Cached computation methods
  // Pagination controls
  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.cdr.markForCheck();
    }
  }
  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.cdr.markForCheck();
    }
  }
  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.cdr.markForCheck();
    }
  }

  getPlayerAvatar(player: PlayerInfo): string {
    return player.avatar || '/assets/images/default-avatar.svg';
  }

  getVideoEmbedUrl(url: string | undefined): SafeResourceUrl {
    if (!url) {
      console.warn('⚠️ Empty video URL provided');
      return this.sanitizer.bypassSecurityTrustResourceUrl('');
    }
    
    console.log('🎥 Processing video URL:', url);
    let embedUrl = '';
    
    // YouTube (regular, shorts, mobile)
    const youtubeRegex = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1`;
      console.log('✅ YouTube video detected, embed URL:', embedUrl);
      return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }
    
    // TikTok - Enhanced support
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      const tiktokMatch = url.match(/\/video\/(\d+)|@[\w.]+\/video\/(\d+)|vm\.tiktok\.com\/([a-zA-Z0-9]+)/);
      if (tiktokMatch) {
        const videoId = tiktokMatch[1] || tiktokMatch[2] || tiktokMatch[3];
        embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
        console.log('✅ TikTok video detected, embed URL:', embedUrl);
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      }
    }
    
    // Instagram Reels & Posts
    if (url.includes('instagram.com')) {
      // Support both /reel/ and /p/ (posts)
      const instaMatch = url.match(/\/(reel|p|tv)\/([a-zA-Z0-9_-]+)/);
      if (instaMatch) {
        const mediaId = instaMatch[2];
        embedUrl = `https://www.instagram.com/${instaMatch[1]}/${mediaId}/embed`;
        console.log('✅ Instagram media detected, embed URL:', embedUrl);
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      }
    }
    
    // Facebook videos - Enhanced support
    if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.me')) {
      embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`;
      console.log('✅ Facebook video detected, embed URL:', embedUrl);
      return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }
    
    // Vimeo support
    if (url.includes('vimeo.com')) {
      const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`;
        console.log('✅ Vimeo video detected, embed URL:', embedUrl);
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      }
    }
    
    // Dailymotion support
    if (url.includes('dailymotion.com') || url.includes('dai.ly')) {
      const dmMatch = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
      if (dmMatch) {
        embedUrl = `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
        console.log('✅ Dailymotion video detected, embed URL:', embedUrl);
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      }
    }
    
    // Twitch clips and videos
    if (url.includes('twitch.tv')) {
      if (url.includes('/clip/')) {
        const clipMatch = url.match(/clip\/([a-zA-Z0-9_-]+)/);
        if (clipMatch) {
          embedUrl = `https://clips.twitch.tv/embed?clip=${clipMatch[1]}&parent=${window.location.hostname}`;
          console.log('✅ Twitch clip detected, embed URL:', embedUrl);
          return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
        }
      } else {
        const videoMatch = url.match(/videos\/(\d+)/);
        if (videoMatch) {
          embedUrl = `https://player.twitch.tv/?video=${videoMatch[1]}&parent=${window.location.hostname}`;
          console.log('✅ Twitch video detected, embed URL:', embedUrl);
          return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
        }
      }
    }
    
    // Twitter/X videos
    if (url.includes('twitter.com') || url.includes('x.com')) {
      // Twitter requires the full tweet URL for embedding
      console.log('✅ Twitter/X video detected');
      console.warn('⚠️ Twitter videos require embedding the entire tweet. Using Twitter\'s embed API.');
      // Note: Twitter embed might need additional setup, using iframe as fallback
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    
    // Streamable support
    if (url.includes('streamable.com')) {
      const streamMatch = url.match(/streamable\.com\/([a-zA-Z0-9]+)/);
      if (streamMatch) {
        embedUrl = `https://streamable.com/e/${streamMatch[1]}`;
        console.log('✅ Streamable video detected, embed URL:', embedUrl);
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      }
    }
    
    // OneDrive videos
    if (url.includes('1drv.ms') || url.includes('onedrive.live.com')) {
      console.log('📁 OneDrive URL detected');
      if (url.includes('onedrive.live.com/embed')) {
        console.log('✅ OneDrive embed URL (already formatted):', url);
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
      } else if (url.includes('1drv.ms')) {
        console.warn('⚠️ OneDrive short link detected. Please use the embed link from OneDrive share options.');
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
      } else {
        const embedOneDrive = url.replace('/view.aspx', '/embed').replace('?', '&').replace('&', '?');
        console.log('🔄 Converting OneDrive URL to embed format:', embedOneDrive);
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedOneDrive);
      }
    }
    
    // Google Drive videos
    if (url.includes('drive.google.com')) {
      console.log('📁 Google Drive URL detected');
      let fileId = '';
      if (url.includes('/file/d/')) {
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      } else if (url.includes('id=')) {
        const match = url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      }
      
      if (fileId) {
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        console.log('✅ Google Drive embed URL:', embedUrl);
        return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      } else {
        console.warn('❌ Could not extract Google Drive file ID from:', url);
      }
    }
    
    // Dropbox support
    if (url.includes('dropbox.com')) {
      // Convert dropbox sharing link to direct link
      const dropboxUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
      console.log('✅ Dropbox video detected, direct URL:', dropboxUrl);
      return this.sanitizer.bypassSecurityTrustResourceUrl(dropboxUrl);
    }
    
    // Default: try to use the URL directly (for direct video file URLs like .mp4, .webm)
    console.log('🔄 Using URL directly (fallback):', url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  async loadPlayersFromService() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.allPlayers = this.playerService.getAllPlayers();
      this.processPlayersData();
      
      // Complete performance monitoring
      if (this.componentLoadId) {
        this.performanceService.endComponentLoad(this.componentLoadId, 'PlayersSimpleComponent');
        this.componentLoadId = null;
      }
    } catch (error) {
      console.error('Error loading players from service:', error);
      this.errorMessage = `Service error: ${error}`;
      // Fallback to direct loading
      await this.testLoadPlayers();
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  viewPlayerDetails(player: PlayerInfo) {
    console.log('👤 Viewing player details:', player.firstName, player.lastName);
    console.log('📹 Player videoUrl:', player.videoUrl);
    console.log('🔍 Full player data:', JSON.stringify(player, null, 2));
    
    if (player.videoUrl) {
      console.log('✅ Video URL exists, will attempt to embed');
    } else {
      console.warn('⚠️ No video URL found for this player');
    }
    
    this.selectedPlayer = player;
    this.isDetailOpen = true;
    this.isCreateOpen = false;
    this.isEditOpen = false;
    this.cdr.markForCheck();
  }

  openCreatePlayerModal() {
    this.resetCreateModel();
    this.isCreateOpen = true;
    this.isDetailOpen = false;
    this.isEditOpen = false;
    this.cdr.markForCheck();
  }

  exportPlayerStats() {
    console.log('Exporting player statistics');
    // Implementation for exporting data
  }

  openEditPlayer(player: PlayerInfo) {
    this.selectedPlayer = player;
    this.editModel = { ...player };
    this.isEditOpen = true;
    this.isDetailOpen = false;
    this.isCreateOpen = false;
    this.cdr.markForCheck();
  }

  async deleteSelectedPlayer() {
    if (!this.selectedPlayer) return;
    
    const playerName = `${this.selectedPlayer.firstName} ${this.selectedPlayer.lastName || ''}`.trim();
    const confirmMsg = `Xác nhận xóa cầu thủ "${playerName}"?\n\nHành động này không thể hoàn tác.`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      await this.playerService.deletePlayer(this.selectedPlayer.id);
      console.log('✅ Deleted player:', playerName);
      this.closePanels();
    } catch (error) {
      console.error('❌ Failed to delete player:', error);
      alert('Không thể xóa cầu thủ. Vui lòng thử lại.');
    }
  }

  closePanels() {
    this.isDetailOpen = false;
    this.isCreateOpen = false;
    this.isEditOpen = false;
    this.cdr.markForCheck();
  }

  resetCreateModel() {
    this.createModel = { firstName: '', lastName: '', position: '', dateOfBirth: '', avatar: '', notes: '' };
  }

  async submitCreate() {
    if (!this.createModel.firstName) return;
    try {
      const rawDate = this.createModel.dateOfBirth || this.readRawFormDate('createPlayerForm');
      const base: Omit<PlayerInfo, 'id' | 'stats' | 'createdAt' | 'updatedAt'> = {
        firstName: this.createModel.firstName || '',
        lastName: this.createModel.lastName || '',
        fullName: `${this.createModel.firstName || ''} ${this.createModel.lastName || ''}`.trim(),
        position: this.createModel.position || 'Chưa xác định',
        dateOfBirth: this.normalizeDate(rawDate),
        height: this.normalizeNumber(this.createModel.height),
        weight: this.normalizeNumber(this.createModel.weight),
        isRegistered: true,
        status: PlayerStatus.ACTIVE,
        avatar: this.createModel.avatar || '',
        videoUrl: this.createModel.videoUrl || '',
        notes: this.createModel.notes || ''
      };
      console.log('💾 Creating player with videoUrl:', base.videoUrl);
      await this.playerService.createPlayer(base);
  this.toast.success('Đã tạo cầu thủ mới');
      // Rely on reactive subscription instead of manual reload
      this.closePanels();
    } catch (e) {
      console.error('Error creating player', e);
    }
  }

  async onCreateAvatarFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;
    const file = input.files[0];
    this.uploadError='';
    this.uploadingCreate = true;
    try {
      const result = await this.avatarUploadService.uploadAvatar(file);
      this.createModel.avatar = result.url;
      // Auto-fill first name from file base name if empty
      if (!this.createModel.firstName?.trim()) {
        const baseName = file.name.replace(/\.[^.]+$/, '');
        this.createModel.firstName = this.extractNameFromFilename(baseName);
      }
    } catch (err) {
      this.uploadError = (err as Error).message;
    } finally {
      this.uploadingCreate = false;
      this.cdr.markForCheck();
    }
  }

  async submitEdit() {
    if (!this.editModel || !this.editModel.id) return;
    try {
      const rawDate = this.editModel.dateOfBirth || this.readRawFormDate('editPlayerForm');
      const updates: Partial<PlayerInfo> = {
        firstName: this.editModel.firstName,
        lastName: this.editModel.lastName,
        fullName: `${this.editModel.firstName || ''} ${this.editModel.lastName || ''}`.trim(),
        position: this.editModel.position,
        dateOfBirth: this.normalizeDate(rawDate),
        height: this.normalizeNumber(this.editModel.height),
        weight: this.normalizeNumber(this.editModel.weight),
        avatar: this.editModel.avatar || '',
        videoUrl: this.editModel.videoUrl || '',
        notes: this.editModel.notes || ''
      };
      console.log('💾 Saving player with videoUrl:', updates.videoUrl);
      await this.playerService.updatePlayer(this.editModel.id, updates);
  this.toast.success('Đã cập nhật cầu thủ');
      // Rely on reactive subscription instead of manual reload
      this.closePanels();
    } catch (e) {
      console.error('Error updating player', e);
    }
  }

  async onEditAvatarFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length || !this.editModel) return;
    const file = input.files[0];
    this.uploadError='';
    this.uploadingEdit = true;
    try {
      const result = await this.avatarUploadService.uploadAvatar(file);
      this.editModel.avatar = result.url;
    } catch (err) {
      this.uploadError = (err as Error).message;
    } finally {
      this.uploadingEdit = false;
      this.cdr.markForCheck();
    }
  }

  private extractNameFromFilename(raw: string): string {
    // Remove non letter/space chars, collapse spaces, capitalize first letter
    const cleaned = raw
      .replace(/[_-]+/g, ' ') // separators to space
      .replace(/\d+/g, '') // numbers removed
      .trim();
    if (!cleaned) return '';
    // Simple title case on first token
    return cleaned.split(/\s+/).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
  }

  private normalizeNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    const parsed = parseFloat(String(value).trim());
    return isNaN(parsed) ? 0 : parsed;
  }

  private normalizeDate(value: unknown): string {
    if (!value) return '';
    let raw = String(value).trim();
    // Replace slashes/spaces like '01 / 01 / 1989' -> '01/01/1989'
    raw = raw.replace(/\s*\/\s*/g, '/');
    // If pattern DD/MM/YYYY or YYYY-MM-DD
    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const yyyymmdd = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;
    if (ddmmyyyy.test(raw)) {
      const [,d,m,y] = raw.match(ddmmyyyy)!;
      return `${y}-${m}-${d}`; // ISO format
    }
    if (yyyymmdd.test(raw)) {
      const [,y,m,d] = raw.match(yyyymmdd)!;
      return `${y}-${m}-${d}`;
    }
    // Try Date parse fallback
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth()+1).padStart(2,'0');
      const d = String(parsed.getDate()).padStart(2,'0');
      return `${y}-${m}-${d}`;
    }
    return '';
  }

  onCreateDobChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.createModel.dateOfBirth = this.normalizeDate(input.value);
  }

  onEditDobChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (this.editModel) {
      this.editModel.dateOfBirth = this.normalizeDate(input.value);
    }
  }

  private readRawFormDate(formId: string): string {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return '';
    const dateInput = form.querySelector('input[name="dateOfBirth"]') as HTMLInputElement | null;
    return dateInput?.value || '';
  }

  private isValidPhysical(height: unknown, weight: unknown): boolean {
    const h = this.normalizeNumber(height);
    const w = this.normalizeNumber(weight);
    if (h && (h < this.minHeight || h > this.maxHeight)) return false;
    if (w && (w < this.minWeight || w > this.maxWeight)) return false;
    return true;
  }
  isHeightValid(h: unknown): boolean { const v = this.normalizeNumber(h); return !v || (v >= this.minHeight && v <= this.maxHeight); }
  isWeightValid(w: unknown): boolean { const v = this.normalizeNumber(w); return !v || (v >= this.minWeight && v <= this.maxWeight); }

  onCreateHeightChange(e: Event) { const v = (e.target as HTMLInputElement).value; this.createModel.height = this.normalizeNumber(v); if(!this.isHeightValid(this.createModel.height)) this.toast.error(`Chiều cao phải trong khoảng ${this.minHeight}-${this.maxHeight}`); }
  onCreateWeightChange(e: Event) { const v = (e.target as HTMLInputElement).value; this.createModel.weight = this.normalizeNumber(v); if(!this.isWeightValid(this.createModel.weight)) this.toast.error(`Cân nặng phải trong khoảng ${this.minWeight}-${this.maxWeight}`); }
  onEditHeightChange(e: Event) { if (!this.editModel) return; const v = (e.target as HTMLInputElement).value; this.editModel.height = this.normalizeNumber(v); if(!this.isHeightValid(this.editModel.height)) this.toast.error(`Chiều cao phải trong khoảng ${this.minHeight}-${this.maxHeight}`); }
  onEditWeightChange(e: Event) { if (!this.editModel) return; const v = (e.target as HTMLInputElement).value; this.editModel.weight = this.normalizeNumber(v); if(!this.isWeightValid(this.editModel.weight)) this.toast.error(`Cân nặng phải trong khoảng ${this.minWeight}-${this.maxWeight}`); }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up performance monitoring if still active
    if (this.componentLoadId) {
      this.performanceService.endComponentLoad(this.componentLoadId, 'PlayersSimpleComponent');
    }
  }
}