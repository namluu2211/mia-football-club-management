import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService, HistoryEntry } from '../../services/firebase.service';
import { DataStoreService } from '../../core/services/data-store.service';
import { FormsModule } from '@angular/forms';
import { PermissionService } from '../../core/services/permission.service';
import { CanEditDirective } from '../../shared/can-edit.directive';
import { FirebaseAuthService } from '../../services/firebase-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, CanEditDirective],
  template: `
    <div class="history-container">
      <!-- Modern Header Section -->
      <div class="header-section">
        <div class="header-backdrop"></div>
        <div class="header-content">
          <div class="title-section">
            <h1 class="page-title">
              <i class="fas fa-history"></i>
              Lịch sử trận đấu
            </h1>
            <p class="page-subtitle">Xem lại các trận đấu đã qua và quản lý tài chính</p>
          </div>
          <div class="header-actions">
            <div class="match-count-badge">
              <i class="fas fa-trophy"></i>
              <span>{{ filteredMatches.length }}/{{ matches.length }}</span>
            </div>
            <button class="action-button sync-btn" (click)="syncData()">
              <i class="fas fa-sync-alt"></i>
              <span>Sync Data</span>
            </button>
            <button 
              class="action-button fund-sync-btn" 
              (click)="syncFundFromHistory()" 
              [disabled]="isSyncingFund"
              *appCanEdit>
              <i class="fas" [class.fa-sync-alt]="isSyncingFund" [class.fa-spin]="isSyncingFund" [class.fa-coins]="!isSyncingFund"></i>
              <span>{{ isSyncingFund ? 'Đang sync...' : 'Sync Fund' }}</span>
            </button>
            <button class="action-button export-btn" (click)="exportData()">
              <i class="fas fa-file-export"></i>
              <span>Xuất dữ liệu</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Fund Sync Result -->
      <div class="fund-sync-alert success-alert" *ngIf="showFundSyncResult" aria-live="polite" aria-atomic="true">
        <i class="fas fa-check-circle"></i>
        <span>{{ fundSyncMessage }}</span>
      </div>

      <!-- Modern Financial Overview Section -->
      <div class="financial-overview-section">
        <div class="section-header-modern">
          <div class="header-left">
            <i class="fas fa-chart-line"></i>
            <h2>Tổng quan tài chính</h2>
          </div>
        </div>
        
        <div class="financial-cards-grid">
          <!-- Revenue Card -->
          <div class="financial-card revenue-card">
            <div class="card-icon-wrapper">
              <i class="fas fa-money-bill-wave"></i>
              <div class="icon-glow"></div>
            </div>
            <div class="card-content">
              <div class="card-label">Tổng thu nhập</div>
              <div class="card-value">{{ getTotalRevenue() | number:'1.0-0' }}</div>
              <div class="card-subtitle">
                <i class="fas fa-trophy"></i>
                {{ matches.length }} trận đấu
              </div>
            </div>
            <div class="card-decoration"></div>
          </div>
          
          <!-- Expense Card -->
          <div class="financial-card expense-card">
            <div class="card-icon-wrapper">
              <i class="fas fa-receipt"></i>
              <div class="icon-glow"></div>
            </div>
            <div class="card-content">
              <div class="card-label">Tổng chi phí</div>
              <div class="card-value">{{ getTotalExpenses() | number:'1.0-0' }}</div>
              <div class="card-subtitle">
                <i class="fas fa-info-circle"></i>
                Sân, trọng tài, nước
              </div>
            </div>
            <div class="card-decoration"></div>
          </div>
          
          <!-- Balance Card -->
          <div class="financial-card balance-card" [class.positive]="getNetProfit() >= 0" [class.negative]="getNetProfit() < 0">
            <div class="card-icon-wrapper">
              <i class="fas fa-balance-scale"></i>
              <div class="icon-glow"></div>
            </div>
            <div class="card-content">
              <div class="card-label">Hòa vốn</div>
              <div class="card-value">{{ getNetProfit() | number:'1.0-0' }}</div>
              <div class="card-subtitle">
                <i class="fas" [class.fa-arrow-up]="getNetProfit() >= 0" [class.fa-arrow-down]="getNetProfit() < 0"></i>
                {{ getNetProfit() >= 0 ? 'Tổng Lãi' : 'Tổng Lỗ' }}
              </div>
            </div>
            <div class="card-decoration"></div>
          </div>

          <!-- Average Card -->
          <div class="financial-card average-card">
            <div class="card-icon-wrapper">
              <i class="fas fa-calculator"></i>
              <div class="icon-glow"></div>
            </div>
            <div class="card-content">
              <div class="card-label">TB mỗi trận</div>
              <div class="card-value">{{ getAveragePerMatch() | number:'1.0-0' }}</div>
              <div class="card-subtitle">
                <i class="fas fa-chart-bar"></i>
                Lãi mỗi trận
              </div>
            </div>
            <div class="card-decoration"></div>
          </div>
        </div>
      </div>

      <!-- Kết quả trận đấu Section -->
      <div class="matches-section">
        <div class="section-header">
          <h2 class="section-title">Kết quả trận đấu</h2>
        </div>

  <div class="matches-list" *ngIf="!loading && filteredMatches.length > 0; else loadingOrEmpty">
          <!-- Date Groups -->
          <div class="date-group" *ngFor="let dateGroup of getMatchesByDate(); trackBy: trackByDateGroup">
            <!-- Date Group Header -->
            <div 
              class="date-group-header"
              [class.collapsed]="isDateCollapsed(dateGroup.date)"
              (click)="toggleDateCollapse(dateGroup.date)"
              (keydown)="toggleDateCollapse(dateGroup.date, $event)"
              tabindex="0"
              role="button"
              [attr.aria-expanded]="!isDateCollapsed(dateGroup.date)"
              [attr.aria-controls]="'date-group-' + dateGroup.date"
              [attr.aria-label]="'Toggle matches for ' + getDateDisplayText(dateGroup.date)">
              
              <div class="date-header-content">
                <h3 class="date-title">{{ getDateDisplayText(dateGroup.date) }}</h3>
                <span class="match-count">{{ getMatchCountForDate(dateGroup.matches) }}</span>
              </div>
              
              <div class="collapse-indicator">
                <span class="collapse-icon" [attr.aria-hidden]="true">
                  {{ isDateCollapsed(dateGroup.date) ? '▶' : '▼' }}
                </span>
              </div>
            </div>

            <!-- Date Group Content -->
            <div 
              class="date-group-content"
              [class.collapsed]="isDateCollapsed(dateGroup.date)"
              [id]="'date-group-' + dateGroup.date"
              [attr.aria-hidden]="isDateCollapsed(dateGroup.date)">
              
              <!-- Individual match cards for this date -->
              <div class="match-card" 
                   *ngFor="let match of dateGroup.matches; trackBy: trackByMatchId"
                   [class.collapsed]="isMatchCollapsed(match.id)">
                
                <!-- Match Header (Always Visible - Collapsed State) -->
                <div 
                  class="match-header-clickable"
                  (click)="toggleMatchCollapse(match.id, $event)"
                  (keydown.enter)="toggleMatchCollapse(match.id, $event)"
                  (keydown.space)="toggleMatchCollapse(match.id, $event)"
                  tabindex="0"
                  role="button"
                  [attr.aria-expanded]="!isMatchCollapsed(match.id)"
                  [attr.aria-controls]="'match-details-' + match.id">
                  
                  <div class="match-summary">
                    <div class="match-date-inline">
                      <i class="fas fa-calendar-alt"></i>
                      <span class="date-text">{{ formatMatchDate(match.date) }}</span>
                    </div>
                    
                    <div class="score-summary">
                      <span class="team-name-short blue">Đội Xanh</span>
                      <span class="score-badge">{{ match.scoreA || 0 }}</span>
                      <span class="vs-text">-</span>
                      <span class="score-badge">{{ match.scoreB || 0 }}</span>
                      <span class="team-name-short orange">Đội Cam</span>
                    </div>
                    
                    <div class="match-actions-inline" *appCanEdit role="presentation" (click)="$event.stopPropagation()">
                      <button class="action-btn-small edit" (click)="editMatch(match)" title="Chỉnh sửa">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="action-btn-small delete" (click)="confirmDeleteMatch(match)" title="Xóa">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  
                  <div class="collapse-indicator-match">
                    <i class="fas" [class.fa-chevron-down]="isMatchCollapsed(match.id)" [class.fa-chevron-up]="!isMatchCollapsed(match.id)"></i>
                  </div>
                </div>

                <!-- Match Details (Expandable Content) -->
                <div 
                  class="match-details"
                  [class.collapsed]="isMatchCollapsed(match.id)"
                  [id]="'match-details-' + match.id"
                  [attr.aria-hidden]="isMatchCollapsed(match.id)">

            <!-- Score Display -->
            <div class="score-display">
              <div class="team team-blue">
                <div class="team-name">Đội Xanh</div>
                <div class="team-score">{{ match.scoreA || 0 }}</div>
              </div>
              
              <div class="vs-divider">VS</div>
              
              <div class="team team-orange">
                <div class="team-name">Đội Cam</div>
                <div class="team-score">{{ match.scoreB || 0 }}</div>
              </div>
            </div>
            
            <!-- Team Players -->
            <div class="teams-display" *ngIf="match.teamA || match.teamB">
              <div class="team-players blue">
                <div class="team-header">
                  <span class="team-dot blue-dot"></span>
                  Đội Xanh ({{ getTeamSize(match.teamA) }})
                </div>
                <div class="players-grid">
                  <span class="player-tag" *ngFor="let player of match.teamA">{{ player }}</span>
                </div>
              </div>
              
              <div class="team-players orange">
                <div class="team-header">
                  <span class="team-dot orange-dot"></span>
                  Đội Cam ({{ getTeamSize(match.teamB) }})
                </div>
                <div class="players-grid">
                  <span class="player-tag" *ngFor="let player of match.teamB">{{ player }}</span>
                </div>
              </div>
            </div>

            <!-- Match Statistics -->
            <div class="match-statistics" *ngIf="getGoalScorers(match, 'A') || getGoalScorers(match, 'B') || getAssists(match, 'A') || getAssists(match, 'B') || getCards(match, 'A', 'yellow') || getCards(match, 'B', 'yellow') || getCards(match, 'A', 'red') || getCards(match, 'B', 'red')">
              <div class="stats-header">
                <span class="stats-title">📊 Thống kê trận đấu</span>
              </div>
              
              <div class="stats-content">
                <!-- Goals Section -->
                <div class="stat-section" *ngIf="getGoalScorers(match, 'A') || getGoalScorers(match, 'B')">
                  <div class="stat-title">
                    <i class="fas fa-futbol"></i>
                    Bàn thắng
                  </div>
                  <div class="stat-teams">
                    <div class="team-stat blue" *ngIf="getGoalScorers(match, 'A')">
                      <span class="team-label">Đội Xanh:</span>
                      <span class="stat-value">{{ getGoalScorers(match, 'A') }}</span>
                    </div>
                    <div class="team-stat orange" *ngIf="getGoalScorers(match, 'B')">
                      <span class="team-label">Đội Cam:</span>
                      <span class="stat-value">{{ getGoalScorers(match, 'B') }}</span>
                    </div>
                  </div>
                </div>

                <!-- Assists Section -->
                <div class="stat-section" *ngIf="getAssists(match, 'A') || getAssists(match, 'B')">
                  <div class="stat-title">
                    <i class="fas fa-hands-helping"></i>
                    Kiến tạo
                  </div>
                  <div class="stat-teams">
                    <div class="team-stat blue" *ngIf="getAssists(match, 'A')">
                      <span class="team-label">Đội Xanh:</span>
                      <span class="stat-value">{{ getAssists(match, 'A') }}</span>
                    </div>
                    <div class="team-stat orange" *ngIf="getAssists(match, 'B')">
                      <span class="team-label">Đội Cam:</span>
                      <span class="stat-value">{{ getAssists(match, 'B') }}</span>
                    </div>
                  </div>
                </div>

                <!-- Own Goals Section -->
                <div class="stat-section" *ngIf="getOwnGoals(match, 'A') || getOwnGoals(match, 'B')">
                  <div class="stat-title">
                    <i class="fas fa-times-circle text-danger"></i>
                    Phản lưới
                  </div>
                  <div class="stat-teams">
                    <div class="team-stat blue" *ngIf="getOwnGoals(match, 'A')">
                      <span class="team-label">Đội Xanh:</span>
                      <span class="stat-value">{{ getOwnGoals(match, 'A') }}</span>
                    </div>
                    <div class="team-stat orange" *ngIf="getOwnGoals(match, 'B')">
                      <span class="team-label">Đội Cam:</span>
                      <span class="stat-value">{{ getOwnGoals(match, 'B') }}</span>
                    </div>
                  </div>
                </div>

                <!-- Yellow Cards Section -->
                <div class="stat-section" *ngIf="getCards(match, 'A', 'yellow') || getCards(match, 'B', 'yellow')">
                  <div class="stat-title">
                    <i class="fas fa-square text-warning"></i>
                    Thẻ vàng
                  </div>
                  <div class="stat-teams">
                    <div class="team-stat blue" *ngIf="getCards(match, 'A', 'yellow')">
                      <span class="team-label">Đội Xanh:</span>
                      <span class="stat-value">{{ getCards(match, 'A', 'yellow') }}</span>
                    </div>
                    <div class="team-stat orange" *ngIf="getCards(match, 'B', 'yellow')">
                      <span class="team-label">Đội Cam:</span>
                      <span class="stat-value">{{ getCards(match, 'B', 'yellow') }}</span>
                    </div>
                  </div>
                </div>

                <!-- Red Cards Section -->
                <div class="stat-section" *ngIf="getCards(match, 'A', 'red') || getCards(match, 'B', 'red')">
                  <div class="stat-title">
                    <i class="fas fa-square text-danger"></i>
                    Thẻ đỏ
                  </div>
                  <div class="stat-teams">
                    <div class="team-stat blue" *ngIf="getCards(match, 'A', 'red')">
                      <span class="team-label">Đội Xanh:</span>
                      <span class="stat-value">{{ getCards(match, 'A', 'red') }}</span>
                    </div>
                    <div class="team-stat orange" *ngIf="getCards(match, 'B', 'red')">
                      <span class="team-label">Đội Cam:</span>
                      <span class="stat-value">{{ getCards(match, 'B', 'red') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Financial Info -->
            <div class="match-finance" *ngIf="match.thu || match.chi_total">
              <div class="finance-header">
                <span class="finance-title">Tài chính</span>
                <span class="finance-summary">
                  Thu: {{ match.thu | number:'1.0-0' }} đ | Chi: {{ match.chi_total | number:'1.0-0' }} đ
                </span>
              </div>
              
              <div class="finance-details">
                <div class="finance-group income">
                  <h4>Thu nhập</h4>
                  <div class="finance-row">
                    <span>Thu chính:</span>
                    <span>{{ match.thu_main || match.thu || 0 | number:'1.0-0' }} đ</span>
                  </div>
                  <div class="finance-total">
                    <strong>Tổng: {{ match.thu | number:'1.0-0' }} đ</strong>
                  </div>
                </div>
                
                <div class="finance-group expense">
                  <h4>Chi phí</h4>
                  <div class="finance-row" *ngIf="match.chi_san">
                    <span>Sân:</span>
                    <span>{{ match.chi_san | number:'1.0-0' }} đ</span>
                  </div>
                  <div class="finance-row" *ngIf="match.chi_trongtai">
                    <span>Trọng tài:</span>
                    <span>{{ match.chi_trongtai | number:'1.0-0' }} đ</span>
                  </div>
                  <div class="finance-row" *ngIf="match.chi_nuoc">
                    <span>Nước:</span>
                    <span>{{ match.chi_nuoc | number:'1.0-0' }} đ</span>
                  </div>
                  <div class="finance-total">
                    <strong>Tổng: {{ match.chi_total | number:'1.0-0' }} đ</strong>
                  </div>
                </div>
              </div>
            </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading / Empty State -->
        <ng-template #loadingOrEmpty>
          <div *ngIf="loading" class="skeleton-list">
            <div class="skeleton-card" *ngFor="let s of skeletonArray">
              <div class="skeleton-line w-40"></div>
              <div class="skeleton-line w-60"></div>
              <div class="skeleton-line w-30"></div>
            </div>
          </div>
          <div *ngIf="!loading" class="empty-state">
            <div class="empty-icon">🏆</div>
            <h3>Chưa có lịch sử trận đấu</h3>
            <p>Bắt đầu thi đấu để xem lịch sử và phân tích tài chính tại đây.</p>
          </div>
        </ng-template>
      </div>
      
      <!-- Edit Match Modal -->
  <div class="modal-overlay" *ngIf="showEditModal && canEdit" (click)="cancelEdit()" tabindex="0" (keydown)="onOverlayKey($event)">
        <div class="modal-content edit-modal" (click)="$event.stopPropagation()" tabindex="0" (keydown)="onModalKey($event)">
          <div class="modal-header">
            <h3>✏️ Chỉnh sửa trận đấu</h3>
            <button class="close-btn" (click)="cancelEdit()">&times;</button>
          </div>
          
          <div class="modal-body">
            <form>
              <!-- Date and Score Section -->
              <div class="form-section">
                <h4>Thông tin trận đấu</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-date">Ngày thi đấu</label>
                    <input id="edit-date" type="date" [(ngModel)]="editFormData.date" name="date" class="form-control">
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-scoreA">Tỷ số Đội Xanh</label>
                    <input id="edit-scoreA" type="number" [(ngModel)]="editFormData.scoreA" name="scoreA" class="form-control" min="0">
                  </div>
                  <div class="form-group">
                    <label for="edit-scoreB">Tỷ số Đội Cam</label>
                    <input id="edit-scoreB" type="number" [(ngModel)]="editFormData.scoreB" name="scoreB" class="form-control" min="0">
                  </div>
                </div>
              </div>

              <!-- Scorers and Assists Section -->
              <div class="form-section">
                <h4>Ghi bàn và Kiến tạo</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-scorerA">Ghi bàn Đội Xanh</label>
                    <input id="edit-scorerA" type="text" [(ngModel)]="editFormData.scorerA" name="scorerA" class="form-control" placeholder="Tên cầu thủ ghi bàn">
                  </div>
                  <div class="form-group">
                    <label for="edit-assistA">Kiến tạo Đội Xanh</label>
                    <input id="edit-assistA" type="text" [(ngModel)]="editFormData.assistA" name="assistA" class="form-control" placeholder="Tên cầu thủ kiến tạo">
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-scorerB">Ghi bàn Đội Cam</label>
                    <input id="edit-scorerB" type="text" [(ngModel)]="editFormData.scorerB" name="scorerB" class="form-control" placeholder="Tên cầu thủ ghi bàn">
                  </div>
                  <div class="form-group">
                    <label for="edit-assistB">Kiến tạo Đội Cam</label>
                    <input id="edit-assistB" type="text" [(ngModel)]="editFormData.assistB" name="assistB" class="form-control" placeholder="Tên cầu thủ kiến tạo">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-ownGoalA">Phản lưới Đội Xanh</label>
                    <input id="edit-ownGoalA" type="text" [(ngModel)]="editFormData.ownGoalA" name="ownGoalA" class="form-control" placeholder="Tên cầu thủ phản lưới">
                  </div>
                  <div class="form-group">
                    <label for="edit-ownGoalB">Phản lưới Đội Cam</label>
                    <input id="edit-ownGoalB" type="text" [(ngModel)]="editFormData.ownGoalB" name="ownGoalB" class="form-control" placeholder="Tên cầu thủ phản lưới">
                  </div>
                </div>
              </div>

              <!-- Cards Section -->
              <div class="form-section">
                <h4>Thẻ phạt</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-yellowA">Thẻ vàng Đội Xanh</label>
                    <input id="edit-yellowA" type="text" [(ngModel)]="editFormData.yellowA" name="yellowA" class="form-control" placeholder="Danh sách cầu thủ nhận thẻ vàng">
                  </div>
                  <div class="form-group">
                    <label for="edit-yellowB">Thẻ vàng Đội Cam</label>
                    <input id="edit-yellowB" type="text" [(ngModel)]="editFormData.yellowB" name="yellowB" class="form-control" placeholder="Danh sách cầu thủ nhận thẻ vàng">
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-redA">Thẻ đỏ Đội Xanh</label>
                    <input id="edit-redA" type="text" [(ngModel)]="editFormData.redA" name="redA" class="form-control" placeholder="Danh sách cầu thủ nhận thẻ đỏ">
                  </div>
                  <div class="form-group">
                    <label for="edit-redB">Thẻ đỏ Đội Cam</label>
                    <input id="edit-redB" type="text" [(ngModel)]="editFormData.redB" name="redB" class="form-control" placeholder="Danh sách cầu thủ nhận thẻ đỏ">
                  </div>
                </div>
              </div>

              <!-- Financial Section -->
              <div class="form-section">
                <h4>Tài chính</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-thu">Tổng thu (đ)</label>
                    <input id="edit-thu" type="number" [(ngModel)]="editFormData.thu" name="thu" class="form-control" min="0">
                  </div>
                  <div class="form-group">
                    <label for="edit-chi_total">Tổng chi (đ)</label>
                    <input id="edit-chi_total" type="number" [(ngModel)]="editFormData.chi_total" name="chi_total" class="form-control" min="0">
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-chi_san">Chi sân (đ)</label>
                    <input id="edit-chi_san" type="number" [(ngModel)]="editFormData.chi_san" name="chi_san" class="form-control" min="0">
                  </div>
                  <div class="form-group">
                    <label for="edit-chi_trongtai">Chi trọng tài (đ)</label>
                    <input id="edit-chi_trongtai" type="number" [(ngModel)]="editFormData.chi_trongtai" name="chi_trongtai" class="form-control" min="0">
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="edit-chi_nuoc">Chi nước (đ)</label>
                    <input id="edit-chi_nuoc" type="number" [(ngModel)]="editFormData.chi_nuoc" name="chi_nuoc" class="form-control" min="0">
                  </div>
                </div>
              </div>
            </form>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Hủy</button>
            <button type="button" class="btn btn-primary" (click)="saveEditedMatch()">💾 Lưu thay đổi</button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
  <div class="modal-overlay" *ngIf="showDeleteModal && canEdit" (click)="cancelDelete()" tabindex="0" (keydown)="onOverlayKey($event)">
        <div class="modal-content delete-modal" (click)="$event.stopPropagation()" tabindex="0" (keydown)="onModalKey($event)">
          <div class="modal-header">
            <h3>🗑️ Xác nhận xóa</h3>
            <button class="close-btn" (click)="cancelDelete()">&times;</button>
          </div>
          
          <div class="modal-body">
            <p>Bạn có chắc chắn muốn xóa trận đấu này không?</p>
            <div class="match-info" *ngIf="matchToDelete">
              <strong>Ngày:</strong> {{ formatMatchDate(matchToDelete.date) }}<br>
              <strong>Tỷ số:</strong> {{ matchToDelete.scoreA || 0 }} - {{ matchToDelete.scoreB || 0 }}
            </div>
            <p class="warning-text">⚠️ Hành động này không thể hoàn tác!</p>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="cancelDelete()">Hủy</button>
            <button type="button" class="btn btn-danger" (click)="deleteMatch()">🗑️ Xóa</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./history.component.css'],
  styles: [`
    /* Modern Base Styles */
    .history-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Modern Header Section */
    .header-section {
      position: relative;
      margin-bottom: 32px;
      overflow: hidden;
      border-radius: 24px;
      animation: slideDown 0.6s ease;
    }

    .header-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px) saturate(180%);
      border: 2px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    }

    .header-content {
      position: relative;
      padding: 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 24px;
    }

    .title-section {
      flex: 1;
    }

    .page-title {
      margin: 0 0 12px 0;
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .page-title i {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .page-subtitle {
      margin: 0;
      font-size: 1.1rem;
      color: #64748b;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .match-count-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      border-radius: 20px;
      font-weight: 700;
      font-size: 1rem;
      box-shadow: 0 4px 16px rgba(17, 153, 142, 0.3);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 4px 16px rgba(17, 153, 142, 0.3);
      }
      50% {
        box-shadow: 0 6px 24px rgba(17, 153, 142, 0.5);
      }
    }

    .action-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border: none;
      border-radius: 16px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .action-button:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    }

    .action-button:active:not(:disabled) {
      transform: translateY(-1px);
    }

    .sync-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .fund-sync-btn {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }

    .fund-sync-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .export-btn {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: white;
    }

    .fa-spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Fund Sync Alert */
    .fund-sync-alert {
      margin: 0 0 24px 0;
      padding: 16px 24px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      animation: slideDown 0.4s ease;
    }

    .success-alert {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      box-shadow: 0 4px 16px rgba(17, 153, 142, 0.3);
    }

    .success-alert i {
      font-size: 1.3rem;
    }

    /* Modern Financial Overview */
    .financial-overview-section {
      margin-bottom: 32px;
      animation: fadeInUp 0.6s ease;
    }

    .section-header-modern {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
    }

    .header-left i {
      font-size: 1.8rem;
    }

    .header-left h2 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 800;
    }

    .financial-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    .financial-card {
      position: relative;
      background: white;
      border-radius: 20px;
      padding: 28px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid transparent;
    }

    .financial-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
    }

    .financial-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, var(--card-color-1), var(--card-color-2));
      transition: height 0.3s ease;
    }

    .financial-card:hover::before {
      height: 8px;
    }

    .revenue-card {
      --card-color-1: #11998e;
      --card-color-2: #38ef7d;
    }

    .expense-card {
      --card-color-1: #ff6b6b;
      --card-color-2: #ee5a6f;
    }

    .balance-card {
      --card-color-1: #4facfe;
      --card-color-2: #00f2fe;
    }

    .balance-card.negative {
      --card-color-1: #ff6b6b;
      --card-color-2: #ee5a6f;
    }

    .average-card {
      --card-color-1: #f093fb;
      --card-color-2: #f5576c;
    }

    .card-decoration {
      position: absolute;
      bottom: -20px;
      right: -20px;
      width: 120px;
      height: 120px;
      background: linear-gradient(135deg, var(--card-color-1), var(--card-color-2));
      border-radius: 50%;
      opacity: 0.08;
      transition: all 0.4s ease;
    }

    .financial-card:hover .card-decoration {
      transform: scale(1.2);
      opacity: 0.12;
    }

    .card-icon-wrapper {
      position: relative;
      width: 70px;
      height: 70px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      background: linear-gradient(135deg, var(--card-color-1), var(--card-color-2));
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    }

    .financial-card:hover .card-icon-wrapper {
      transform: scale(1.1) rotate(-5deg);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
    }

    .card-icon-wrapper i {
      font-size: 2.2rem;
      color: white;
      animation: bounce 2s ease-in-out infinite;
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-5px);
      }
    }

    .icon-glow {
      position: absolute;
      inset: -4px;
      border-radius: 18px;
      background: linear-gradient(135deg, var(--card-color-1), var(--card-color-2));
      opacity: 0.3;
      filter: blur(8px);
      z-index: -1;
      animation: pulseGlow 2s ease-in-out infinite;
    }

    @keyframes pulseGlow {
      0%, 100% {
        opacity: 0.3;
        transform: scale(1);
      }
      50% {
        opacity: 0.5;
        transform: scale(1.05);
      }
    }

    .card-content {
      flex: 1;
    }

    .card-label {
      font-size: 0.9rem;
      font-weight: 600;
      color: #7f8c8d;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .card-value {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--card-color-1), var(--card-color-2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 12px;
      line-height: 1;
    }

    .card-value::after {
      content: ' đ';
      font-size: 1.2rem;
    }

    .card-subtitle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: #7f8c8d;
      font-weight: 600;
    }

    .card-subtitle i {
      color: var(--card-color-1);
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .edit-modal {
      width: 800px;
    }
    
    .delete-modal {
      width: 400px;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }
    
    .modal-header h3 {
      margin: 0;
      font-size: 1.2rem;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }
    
    .close-btn:hover {
      color: #333;
    }
    
    .modal-body {
      padding: 20px;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 20px;
      border-top: 1px solid #eee;
    }
    
    .form-section {
      margin-bottom: 24px;
      padding: 16px;
      border: 1px solid #e1e5e9;
      border-radius: 8px;
      background: #f8f9fa;
    }
    
    .form-section h4 {
      margin: 0 0 16px 0;
      color: #495057;
      font-size: 1rem;
    }
    
    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }
    
    .form-group {
      flex: 1;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #495057;
    }
    
    .form-control {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .form-control:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
    
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    
    .btn-primary {
      background: #007bff;
      color: white;
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    
    .btn:hover {
      opacity: 0.9;
    }
    
    .match-info {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      margin: 16px 0;
    }
    
    .warning-text {
      color: #dc3545;
      font-weight: 500;
      margin: 16px 0 0 0;
    }
    
    .action-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .action-btn:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    
    .action-btn.edit {
      color: #007bff;
    }
    
    .action-btn.delete {
      color: #dc3545;
    }
    
    /* Fund Sync Styles */
    .fund-sync-btn {
      padding: 8px 16px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    
    .fund-sync-btn:hover:not(:disabled) {
      background: #218838;
      transform: translateY(-1px);
    }
    
    .fund-sync-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    .fund-sync-result {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
      animation: slideInDown 0.5s ease-out;
    }

    /* Status & Debug */
    .status-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 12px;
      background: #f1f3f5;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .listener-status {
      padding: 4px 8px;
      border-radius: 6px;
      background: #adb5bd;
      color: #fff;
      font-weight: 500;
    }
    .listener-status.active { background: #28a745; }
    .force-refresh-btn, .toggle-debug-btn {
      background: #0d6efd;
      color: #fff;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .force-refresh-btn:hover, .toggle-debug-btn:hover { opacity: .85; }
    .debug-panel { margin-bottom: 16px; }
    .debug-output {
      background: #212529;
      color: #f8f9fa;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      max-height: 300px;
      overflow: auto;
      line-height: 1.4;
    }
    /* Skeleton */
    .skeleton-list { display: grid; gap: 12px; }
    .skeleton-card { background:#fff; border:1px solid #e9ecef; padding:16px; border-radius:8px; }
    .skeleton-line { height:12px; background:linear-gradient(90deg,#e9ecef 25%,#f8f9fa 50%,#e9ecef 75%); background-size:200% 100%; animation:shimmer 1.2s infinite; border-radius:4px; margin-bottom:10px; }
    .skeleton-line.w-40{width:40%;} .skeleton-line.w-60{width:60%;} .skeleton-line.w-30{width:30%;}
    @keyframes shimmer { from{background-position:200% 0;} to{background-position:-200% 0;} }
    
    .sync-message {
      white-space: pre-line;
      font-weight: 500;
      line-height: 1.5;
    }
    
    @keyframes slideInDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Modern Date Group Styles */
    .date-group {
      margin-bottom: 24px;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid rgba(255, 255, 255, 0.8);
      animation: fadeInUp 0.5s ease;
    }

    .date-group:hover {
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }

    .date-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 28px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      cursor: pointer;
      user-select: none;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .date-group-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s ease;
    }

    .date-group-header:hover::before {
      left: 100%;
    }

    .date-group-header:focus {
      outline: 3px solid rgba(102, 126, 234, 0.4);
      outline-offset: -3px;
    }

    .date-group-header.collapsed {
      border-radius: 20px;
    }

    .date-header-content {
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      z-index: 1;
    }

    .date-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: white;
      margin: 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .date-title i {
      font-size: 1.3rem;
    }

    .match-count {
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(10px);
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 700;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .date-group-header:hover .match-count {
      background: rgba(255, 255, 255, 0.35);
      transform: scale(1.05);
    }

    .collapse-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      z-index: 1;
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
    }

    .date-group-header.collapsed .collapse-indicator {
      transform: rotate(-180deg);
    }

    .collapse-icon {
      font-size: 1.2rem;
      color: white;
      font-weight: bold;
    }

    .date-group-content {
      padding: 0;
      max-height: 5000px;
      overflow: hidden;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 1;
      background: linear-gradient(to bottom, rgba(102, 126, 234, 0.02), transparent);
    }

    .date-group-content.collapsed {
      max-height: 0;
      padding: 0;
      opacity: 0;
    }

    .date-group-content .match-card {
      margin: 20px 24px;
      border-radius: 16px;
    }

    .date-group-content .match-card:first-child {
      margin-top: 24px;
    }

    .date-group-content .match-card:last-child {
      margin-bottom: 24px;
    }

    /* Modern Match Card Styles */
    .match-card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid rgba(102, 126, 234, 0.1);
      margin-bottom: 12px;
    }

    .match-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      border-color: rgba(102, 126, 234, 0.3);
    }

    .match-card.collapsed:hover {
      transform: none;
    }

    /* Clickable Match Header */
    .match-header-clickable {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      cursor: pointer;
      transition: all 0.3s ease;
      border-bottom: 2px solid rgba(102, 126, 234, 0.1);
    }

    .match-header-clickable:hover {
      background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
    }

    .match-header-clickable:focus {
      outline: 2px solid #667eea;
      outline-offset: -2px;
    }

    .match-summary {
      display: flex;
      align-items: center;
      gap: 20px;
      flex: 1;
    }

    .match-date-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      color: #64748b;
      font-weight: 600;
      min-width: 140px;
    }

    .match-date-inline i {
      color: #667eea;
    }

    .score-summary {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
    }

    .team-name-short {
      font-size: 0.9rem;
      padding: 4px 10px;
      border-radius: 8px;
    }

    .team-name-short.blue {
      background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
      color: #0369a1;
    }

    .team-name-short.orange {
      background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
      color: #c2410c;
    }

    .score-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 1.1rem;
      padding: 6px 14px;
      border-radius: 10px;
      min-width: 40px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .vs-text {
      color: #94a3b8;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .match-actions-inline {
      display: flex;
      gap: 6px;
      margin-left: auto;
    }

    .action-btn-small {
      background: white;
      border: 2px solid #e2e8f0;
      color: #64748b;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      font-size: 0.85rem;
    }

    .action-btn-small:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .action-btn-small.edit:hover {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-color: #667eea;
    }

    .action-btn-small.delete:hover {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border-color: #ef4444;
    }

    .collapse-indicator-match {
      display: flex;
      align-items: center;
      color: #667eea;
      font-size: 1.1rem;
      transition: transform 0.3s ease;
      margin-left: 12px;
    }

    .match-card.collapsed .collapse-indicator-match {
      transform: rotate(0deg);
    }

    /* Match Details (Expandable Content) */
    .match-details {
      max-height: 5000px;
      overflow: hidden;
      transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
      opacity: 1;
    }

    .match-details.collapsed {
      max-height: 0;
      opacity: 0;
    }

    .match-date-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-bottom: 2px solid rgba(102, 126, 234, 0.1);
    }

    .date-text {
      font-weight: 700;
      color: #495057;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .date-text::before {
      content: '📅';
      font-size: 1.1rem;
    }

    .match-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      background: white;
      border: 2px solid #e9ecef;
      cursor: pointer;
      font-size: 1.1rem;
      padding: 8px 12px;
      border-radius: 10px;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .action-btn.edit:hover {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: #667eea;
    }

    .action-btn.delete:hover {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      border-color: #ff6b6b;
    }

    /* Score Display */
    .score-display {
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 32px 24px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
      position: relative;
    }

    .score-display::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
      height: 100%;
      background: linear-gradient(to bottom, transparent, rgba(102, 126, 234, 0.2), transparent);
    }

    .team {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      position: relative;
    }

    .team-name {
      font-size: 1.1rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .team-blue .team-name {
      color: #4299e1;
      text-shadow: 0 2px 4px rgba(66, 153, 225, 0.2);
    }

    .team-orange .team-name {
      color: #ed8936;
      text-shadow: 0 2px 4px rgba(237, 137, 54, 0.2);
    }

    .team-score {
      font-size: 3.5rem;
      font-weight: 900;
      line-height: 1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .vs-divider {
      font-size: 1.2rem;
      font-weight: 800;
      color: #9ca3af;
      background: white;
      padding: 12px 16px;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border: 3px solid rgba(102, 126, 234, 0.2);
      z-index: 1;
    }

    /* Teams Display */
    .teams-display {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 24px;
      background: white;
      border-top: 2px solid #f0f2f5;
    }

    .team-players {
      padding: 16px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(66, 153, 225, 0.05), rgba(66, 153, 225, 0.02));
      border: 2px solid rgba(66, 153, 225, 0.15);
    }

    .team-players.orange {
      background: linear-gradient(135deg, rgba(237, 137, 54, 0.05), rgba(237, 137, 54, 0.02));
      border-color: rgba(237, 137, 54, 0.15);
    }

    .team-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      font-weight: 700;
      font-size: 0.95rem;
      color: #4a5568;
    }

    .team-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .blue-dot {
      background: linear-gradient(135deg, #4299e1, #3182ce);
    }

    .orange-dot {
      background: linear-gradient(135deg, #ed8936, #dd6b20);
    }

    .players-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .player-tag {
      padding: 6px 12px;
      background: white;
      border: 2px solid #e9ecef;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #4a5568;
      transition: all 0.2s ease;
    }

    .player-tag:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      border-color: #667eea;
    }

    /* Match Statistics */
    .match-statistics {
      padding: 24px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.03), rgba(118, 75, 162, 0.03));
      border-top: 2px solid #f0f2f5;
    }

    .stats-header {
      margin-bottom: 20px;
    }

    .stats-title {
      font-size: 1.2rem;
      font-weight: 800;
      color: #2d3748;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stats-content {
      display: grid;
      gap: 16px;
    }

    .stat-section {
      background: white;
      padding: 16px;
      border-radius: 12px;
      border: 2px solid #e9ecef;
      transition: all 0.3s ease;
    }

    .stat-section:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }

    .stat-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      color: #4a5568;
      margin-bottom: 12px;
      font-size: 0.95rem;
    }

    .stat-title i {
      color: #667eea;
      font-size: 1.1rem;
    }

    .stat-teams {
      display: grid;
      gap: 8px;
    }

    .team-stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .team-stat.blue {
      background: linear-gradient(135deg, rgba(66, 153, 225, 0.1), rgba(66, 153, 225, 0.05));
      border-left: 4px solid #4299e1;
    }

    .team-stat.orange {
      background: linear-gradient(135deg, rgba(237, 137, 54, 0.1), rgba(237, 137, 54, 0.05));
      border-left: 4px solid #ed8936;
    }

    .team-stat:hover {
      transform: translateX(4px);
    }

    .team-label {
      font-weight: 600;
      color: #4a5568;
      font-size: 0.9rem;
    }

    .stat-value {
      font-weight: 700;
      color: #2d3748;
      font-size: 0.95rem;
    }

    .text-warning {
      color: #fbbf24 !important;
    }

    .text-danger {
      color: #ef4444 !important;
    }

    /* Match Finance */
    .match-finance {
      padding: 24px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.02));
      border-top: 2px solid #f0f2f5;
    }

    .finance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .finance-title {
      font-size: 1.2rem;
      font-weight: 800;
      color: #2d3748;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .finance-title::before {
      content: '💰';
      font-size: 1.3rem;
    }

    .finance-summary {
      padding: 8px 16px;
      background: white;
      border-radius: 20px;
      font-weight: 700;
      font-size: 0.9rem;
      color: #4a5568;
      border: 2px solid #e9ecef;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .finance-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .finance-group {
      background: white;
      padding: 16px;
      border-radius: 12px;
      border: 2px solid #e9ecef;
    }

    .finance-group.income {
      border-left: 4px solid #10b981;
    }

    .finance-group.expense {
      border-left: 4px solid #ef4444;
    }

    .finance-group h4 {
      margin: 0 0 12px 0;
      font-size: 1rem;
      font-weight: 700;
      color: #4a5568;
    }

    .finance-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 0.9rem;
      color: #64748b;
      border-bottom: 1px solid #f0f2f5;
    }

    .finance-row:last-of-type {
      border-bottom: none;
    }

    .finance-total {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px solid #e9ecef;
      text-align: right;
      font-size: 1.1rem;
    }

    .finance-total strong {
      color: #2d3748;
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      .history-container {
        padding: 16px;
      }

      .header-content {
        padding: 24px;
        flex-direction: column;
        align-items: flex-start;
      }

      .page-title {
        font-size: 2rem;
      }

      .header-actions {
        width: 100%;
        justify-content: flex-start;
      }

      .financial-cards-grid {
        grid-template-columns: 1fr;
      }

      .score-display {
        padding: 24px 16px;
      }

      .team-score {
        font-size: 2.5rem;
      }

      .teams-display {
        grid-template-columns: 1fr;
        gap: 16px;
        padding: 16px;
      }

      .finance-details {
        grid-template-columns: 1fr;
      }

      .date-group-header {
        padding: 16px 20px;
      }

      .date-title {
        font-size: 1.1rem;
      }
    }

    @media (max-width: 480px) {
      .page-title {
        font-size: 1.6rem;
      }

      .card-value {
        font-size: 2rem;
      }

      .team-score {
        font-size: 2rem;
      }

      .date-group-content .match-card {
        margin: 16px;
      }
    }
  `]
})
export class HistoryComponent implements OnInit, OnDestroy {
  private firebaseService = inject(FirebaseService);
  private dataStore = inject(DataStoreService);
  private firebaseAuth = inject(FirebaseAuthService);
  private router = inject(Router);
  private permission = inject(PermissionService);
  
  // Removed external canEdit input; compute internally based on admin roles.
  // canEdit true for admin or superadmin with write permission
  canEdit = false;
  
  matches: HistoryEntry[] = [];
  filteredMatches: HistoryEntry[] = [];
  loading = false;
  showDeleteModal = false;
  matchToDelete: HistoryEntry | null = null;
  
  // Edit modal properties
  showEditModal = false;
  matchToEdit: HistoryEntry | null = null;
  editFormData: Partial<HistoryEntry> = {};
  
  // Search and filter properties
  searchTerm = '';
  dateFilter = '';
  scoreFilter = 'all'; // 'all', 'win', 'loss', 'draw'
  
  // Fund sync properties
  isSyncingFund = false;
  fundSyncMessage = '';
  showFundSyncResult = false;

  // Collapse state properties for date groups (months)
  dateCollapseStates: Record<string, boolean> = {};
  private readonly COLLAPSE_STATES_KEY = 'history_date_collapse_states';
  
  // Collapse state properties for individual matches
  matchCollapseStates: Record<string, boolean> = {};
  private readonly MATCH_COLLAPSE_STATES_KEY = 'history_match_collapse_states';

  // Skeleton loading placeholder
  skeletonArray = Array.from({ length: 5 });

  ngOnInit(): void {
    // Centralized permission subscription only
    this.permission.canEditChanges().subscribe(can => this.canEdit = can);
    // Deferred Firebase listeners: ensure history listener is attached only when History route is active
    // Await async attachment to avoid race with lazy core initialization
    (async () => {
      try {
        await this.firebaseService.attachHistoryListener();
        await this.loadMatches();
      } catch (e) {
        console.error('❌ Failed to initialize history listener:', e);
      }
    })();
    this.loadCollapseStates();
    this.loadMatchCollapseStates();
  }

  // Legacy evaluatePermissions removed in favor of centralized PermissionService.

  private historySub: ReturnType<typeof this.firebaseService.history$.subscribe> | null = null;

  async loadMatches(): Promise<void> {
    try {
      this.loading = true;
      console.log('🔄 Subscribing to live match history stream...');
      if (this.historySub) {
        this.historySub.unsubscribe();
      }
      this.historySub = this.firebaseService.history$.subscribe({
        next: (historyData) => {
          console.log('📊 Live history update:', historyData.length, 'matches');
          this.matches = [...historyData];
          this.matches.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ History stream error:', error);
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('❌ Error initializing history subscription:', error);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.historySub) {
      this.historySub.unsubscribe();
      this.historySub = null;
    }
  }

  trackByMatchId(index: number, match: HistoryEntry): string {
    return match.id || index.toString();
  }

  trackByDateGroup(index: number, group: { date: string; matches: HistoryEntry[] }): string {
    return group.date;
  }

  formatMatchDate(date: string | undefined): string {
    if (!date) return 'Unknown Date';
    try {
      const matchDate = new Date(date);
      return matchDate.toLocaleDateString('vi-VN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  }

  getTotalRevenue(): number {
    return this.matches.reduce((total, match) => total + (match.thu || 0), 0);
  }

  getTotalExpenses(): number {
    return this.matches.reduce((total, match) => total + (match.chi_total || 0), 0);
  }

  getNetProfit(): number {
    return this.getTotalRevenue() - this.getTotalExpenses();
  }

  getMatchRevenue(match: HistoryEntry): number {
    return match.thu || 0;
  }

  getMatchExpenses(match: HistoryEntry): number {
    return match.chi_total || 0;
  }

  getMatchResultClass(match: HistoryEntry): string {
    const scoreA = match.scoreA || 0;
    const scoreB = match.scoreB || 0;
    
    if (scoreA > scoreB) return 'win';
    if (scoreB > scoreA) return 'loss';
    return 'draw';
  }

  getMatchResultText(match: HistoryEntry): string {
    const scoreA = match.scoreA || 0;
    const scoreB = match.scoreB || 0;
    
    if (scoreA > scoreB) return 'Win';
    if (scoreB > scoreA) return 'Loss';
    return 'Draw';
  }

  // Financial calculation methods
  getAveragePerMatch(): number {
    console.log('📊 Average profit per match:', this.getNetProfit() / this.matches.length);
    return this.matches.length > 0 ? this.getNetProfit() / this.matches.length : 0;
  }

  // Team methods
  getTeamSize(team: string[] | undefined, match?: HistoryEntry, side?: 'A'|'B'): number {
    if (Array.isArray(team) && team.length) return team.length;
    if (match && side) {
      // Narrow match to extended shape without using any
      type ExtendedHistory = HistoryEntry & {
        teamA_ids?: (string|number)[]; teamB_ids?: (string|number)[];
        teamA_full?: { id?: string|number }[]; teamB_full?: { id?: string|number }[];
      };
      const ext = match as ExtendedHistory;
      const ids = side==='A'? ext.teamA_ids : ext.teamB_ids;
      if (Array.isArray(ids) && ids.length) return ids.length;
      const full = side==='A'? ext.teamA_full : ext.teamB_full;
      if (Array.isArray(full) && full.length) return full.length;
    }
    return 0;
  }

  getGoalScorers(match: HistoryEntry, team: 'A' | 'B'): string {
    const scorer = team === 'A' ? match.scorerA : match.scorerB;
    return scorer || '';
  }

  getAssists(match: HistoryEntry, team: 'A' | 'B'): string {
    const assist = team === 'A' ? match.assistA : match.assistB;
    return assist || '';
  }

  getOwnGoals(match: HistoryEntry, team: 'A' | 'B'): string {
    const ownGoal = team === 'A' ? match.ownGoalA : match.ownGoalB;
    return ownGoal || '';
  }

  getCards(match: HistoryEntry, team: 'A' | 'B', type: 'yellow' | 'red'): string {
    if (type === 'yellow') {
      return team === 'A' ? (match.yellowA || '') : (match.yellowB || '');
    } else {
      return team === 'A' ? (match.redA || '') : (match.redB || '');
    }
  }

  editMatch(match: HistoryEntry): void {
    if (!this.canEdit) {
      console.warn('❌ Edit not allowed - insufficient permissions');
      return;
    }

    console.log('📝 Opening edit modal for match:', match.id);
    this.matchToEdit = match;
    this.editFormData = {
      date: match.date,
      scoreA: match.scoreA || 0,
      scoreB: match.scoreB || 0,
      scorerA: match.scorerA || '',
      scorerB: match.scorerB || '',
      assistA: match.assistA || '',
      assistB: match.assistB || '',
      yellowA: match.yellowA || '',
      yellowB: match.yellowB || '',
      redA: match.redA || '',
      redB: match.redB || '',
      thu: match.thu || 0,
      chi_total: match.chi_total || 0,
      chi_san: match.chi_san || 0,
      chi_trongtai: match.chi_trongtai || 0,
      chi_nuoc: match.chi_nuoc || 0
    };
    this.showEditModal = true;
  }

  confirmDeleteMatch(match: HistoryEntry): void {
    if (!this.canEdit) {
      console.warn('❌ Delete not allowed - insufficient permissions');
      return;
    }

    if (!match.id) {
      console.error('❌ Cannot delete match without ID');
      return;
    }

    console.log('🗑️ Confirming delete for match:', match.id);
    this.matchToDelete = match;
    this.showDeleteModal = true;
  }

  async saveEditedMatch(): Promise<void> {
    if (!this.matchToEdit?.id || !this.editFormData) {
      console.error('❌ Invalid match data for update');
      return;
    }

    // Basic validation
    const validation = this.validateEditForm();
    if (!validation.isValid) {
      console.error('❌ Validation failed:', validation.errors);
      alert(`Dữ liệu không hợp lệ:\n${validation.errors.join('\n')}`);
      return;
    }

    try {
      console.log('💾 Saving edited match:', this.matchToEdit.id, this.editFormData);
      
      // Ensure numeric fields are properly converted
      const updateData = {
        ...this.editFormData,
        scoreA: Number(this.editFormData.scoreA || 0),
        scoreB: Number(this.editFormData.scoreB || 0),
        thu: Number(this.editFormData.thu || 0),
        chi_total: Number(this.editFormData.chi_total || 0),
        chi_san: Number(this.editFormData.chi_san || 0),
        chi_trongtai: Number(this.editFormData.chi_trongtai || 0),
        chi_nuoc: Number(this.editFormData.chi_nuoc || 0)
      };
      
      await this.firebaseService.updateHistoryEntry(this.matchToEdit.id, updateData);
      
      this.showEditModal = false;
      this.matchToEdit = null;
      this.editFormData = {};
      
      console.log('✅ Match updated successfully');
    } catch (error) {
      console.error('❌ Error updating match:', error);
      alert('Có lỗi xảy ra khi cập nhật trận đấu. Vui lòng thử lại.');
    }
  }

  cancelEdit(): void {
    this.showEditModal = false;
    this.matchToEdit = null;
    this.editFormData = {};
  }

  async deleteMatch(): Promise<void> {
    if (!this.matchToDelete?.id) return;

    try {
      console.log('🗑️ Deleting match:', this.matchToDelete.id);
      await this.firebaseService.deleteHistoryEntry(this.matchToDelete.id);
      
      this.showDeleteModal = false;
      this.matchToDelete = null;
      
      console.log('✅ Match deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting match:', error);
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.matchToDelete = null;
  }

  // Accessibility handlers for modal overlays
  onOverlayKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showEditModal) this.cancelEdit();
      if (this.showDeleteModal) this.cancelDelete();
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (this.showEditModal) this.cancelEdit();
    }
  }

  onModalKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.showEditModal) {
      this.cancelEdit();
    }
  }

  private validateEditForm(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!this.editFormData.date) {
      errors.push('Ngày thi đấu không được để trống');
    }

    // Validate numeric fields
    const scoreA = Number(this.editFormData.scoreA);
    const scoreB = Number(this.editFormData.scoreB);
    
    if (scoreA < 0) errors.push('Tỷ số Đội Xanh không được âm');
    if (scoreB < 0) errors.push('Tỷ số Đội Cam không được âm');
    
    // Validate financial fields
    const thu = Number(this.editFormData.thu || 0);
    const chiTotal = Number(this.editFormData.chi_total || 0);
    
    if (thu < 0) errors.push('Tổng thu không được âm');
    if (chiTotal < 0) errors.push('Tổng chi không được âm');

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async syncData(): Promise<void> {
    await this.loadMatches();
  }

  applyFilters(): void {
    let filtered = [...this.matches];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(match => 
        this.formatMatchDate(match.date).toLowerCase().includes(searchLower) ||
        (match.scorerA && match.scorerA.toLowerCase().includes(searchLower)) ||
        (match.scorerB && match.scorerB.toLowerCase().includes(searchLower)) ||
        (match.assistA && match.assistA.toLowerCase().includes(searchLower)) ||
        (match.assistB && match.assistB.toLowerCase().includes(searchLower))
      );
    }

    // Apply date filter
    if (this.dateFilter) {
      const filterDate = new Date(this.dateFilter);
      const filterYear = filterDate.getFullYear();
      const filterMonth = filterDate.getMonth();
      
      filtered = filtered.filter(match => {
        const matchDate = new Date(match.date || '');
        return matchDate.getFullYear() === filterYear && 
               matchDate.getMonth() === filterMonth;
      });
    }

    // Apply score result filter
    if (this.scoreFilter !== 'all') {
      filtered = filtered.filter(match => {
        const scoreA = match.scoreA || 0;
        const scoreB = match.scoreB || 0;
        
        switch (this.scoreFilter) {
          case 'win':
            return scoreA > scoreB;
          case 'loss':
            return scoreB > scoreA;
          case 'draw':
            return scoreA === scoreB;
          default:
            return true;
        }
      });
    }

    this.filteredMatches = filtered;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onDateFilterChange(): void {
    this.applyFilters();
  }

  onScoreFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.dateFilter = '';
    this.scoreFilter = 'all';
    this.applyFilters();
  }

  async syncFundFromHistory(): Promise<void> {
    if (!this.canEdit) {
      console.warn('❌ Fund sync not allowed - insufficient permissions');
      return;
    }

    try {
      this.isSyncingFund = true;
      this.fundSyncMessage = 'Đang đồng bộ quỹ từ lịch sử trận đấu...';
      
      console.log('💰 Starting fund sync from match history...');
      console.log('📊 Processing', this.matches.length, 'matches for fund sync');

      const result = await this.dataStore.syncFundWithMatchHistory(this.matches);
      
      let message = '';
      if (result.transactionsAdded > 0) {
        message = `✅ Đã thêm ${result.transactionsAdded} giao dịch từ lịch sử trận đấu`;
        
        // Also recalculate fund balance to ensure accuracy
        const balanceResult = await this.dataStore.recalculateFundBalanceFromHistory();
        message += `\n💰 Số dư quỹ: ${balanceResult.oldBalance.toLocaleString()} → ${balanceResult.newBalance.toLocaleString()} đ`;
      } else {
        message = '✅ Quỹ đã được đồng bộ, không có giao dịch nào cần thêm';
      }

      if (result.errors.length > 0) {
        message += `\n⚠️ Có ${result.errors.length} lỗi trong quá trình xử lý`;
        console.warn('Fund sync errors:', result.errors);
      }

      this.fundSyncMessage = message;
      this.showFundSyncResult = true;

      // Auto hide message after 5 seconds
      setTimeout(() => {
        this.showFundSyncResult = false;
        this.fundSyncMessage = '';
      }, 5000);

      console.log('✅ Fund sync completed successfully');
      
    } catch (error) {
      console.error('❌ Error syncing fund from history:', error);
      this.fundSyncMessage = `❌ Lỗi khi đồng bộ quỹ: ${(error as Error).message}`;
      this.showFundSyncResult = true;
      
      setTimeout(() => {
        this.showFundSyncResult = false;
        this.fundSyncMessage = '';
      }, 5000);
    } finally {
      this.isSyncingFund = false;
    }
  }

  exportData(): void {
    const dataStr = JSON.stringify(this.filteredMatches, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `thanglong_fc_history_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    console.log('✅ Data exported successfully');
  }

  // Date grouping and collapse functionality
  getMatchesByDate(): { date: string; matches: HistoryEntry[] }[] {
    const groups: Record<string, HistoryEntry[]> = {};
    
    // Group filtered matches by month (YYYY-MM format)
    this.filteredMatches.forEach(match => {
      if (!match.date || match.date === 'unknown') {
        const dateKey = 'unknown';
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(match);
      } else {
        // Extract year and month from date (YYYY-MM)
        const matchDate = new Date(match.date);
        const year = matchDate.getFullYear();
        const month = String(matchDate.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        if (!groups[monthKey]) {
          groups[monthKey] = [];
        }
        groups[monthKey].push(match);
      }
    });

    // Convert to sorted array of groups (most recent month first)
    return Object.keys(groups)
      .sort((a, b) => {
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        return b.localeCompare(a); // Descending order for YYYY-MM format
      })
      .map(monthKey => ({
        date: monthKey,
        matches: groups[monthKey].sort((a, b) => 
          new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
        )
      }));
  }

  isDateCollapsed(date: string): boolean {
    return this.dateCollapseStates[date] === true;
  }

  toggleDateCollapse(date: string, event?: KeyboardEvent): void {
    // Handle keyboard events for accessibility
    if (event && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (event) {
      event.preventDefault();
    }

    this.dateCollapseStates[date] = !this.dateCollapseStates[date];
    this.saveCollapseStates();
  }

  private loadCollapseStates(): void {
    try {
      const saved = localStorage.getItem(this.COLLAPSE_STATES_KEY);
      if (saved) {
        this.dateCollapseStates = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Could not load collapse states:', error);
      this.dateCollapseStates = {};
    }
  }

  private saveCollapseStates(): void {
    try {
      localStorage.setItem(this.COLLAPSE_STATES_KEY, JSON.stringify(this.dateCollapseStates));
    } catch (error) {
      console.warn('Could not save collapse states:', error);
    }
  }

  // Match collapse methods
  isMatchCollapsed(matchId: string): boolean {
    // By default, all matches are collapsed (true)
    return this.matchCollapseStates[matchId] !== false;
  }

  toggleMatchCollapse(matchId: string, event?: Event): void {
    if (event) {
      event.stopPropagation(); // Prevent triggering parent collapse
    }
    
    this.matchCollapseStates[matchId] = !this.isMatchCollapsed(matchId);
    this.saveMatchCollapseStates();
  }

  private loadMatchCollapseStates(): void {
    try {
      const saved = localStorage.getItem(this.MATCH_COLLAPSE_STATES_KEY);
      if (saved) {
        this.matchCollapseStates = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Could not load match collapse states:', error);
      this.matchCollapseStates = {};
    }
  }

  private saveMatchCollapseStates(): void {
    try {
      localStorage.setItem(this.MATCH_COLLAPSE_STATES_KEY, JSON.stringify(this.matchCollapseStates));
    } catch (error) {
      console.warn('Could not save match collapse states:', error);
    }
  }

  getDateDisplayText(date: string): string {
    if (!date || date === 'unknown') return 'Ngày không xác định';
    
    // Handle month format (YYYY-MM)
    if (date.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = date.split('-');
      const monthNames = [
        'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
        'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'
      ];
      const monthIndex = parseInt(month, 10) - 1;
      return `${monthNames[monthIndex]}, ${year}`;
    }
    
    return this.formatMatchDate(date);
  }

  getMatchCountForDate(matches: HistoryEntry[]): string {
    const count = matches.length;
    return count === 1 ? '1 trận' : `${count} trận`;
  }
}