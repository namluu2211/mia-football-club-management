import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { Player } from '../players/player-utils';
import { StatisticsService } from '../../core/services/statistics.service';
import { MatchService } from '../../core/services/match.service';
import { PlayerService } from '../../core/services/player.service';
import { DataStoreService } from '../../core/services/data-store.service';
import { PlayerInfo } from '../../core/models/player.model';
import { MatchInfo } from '../../core/models/match.model';
import { FirebaseService, HistoryEntry } from '../../services/firebase.service';

interface MatchData {
  id?: string;
  date?: string;
  description?: string;
  
  // Team data - can be arrays of strings OR arrays of Player objects for backward compatibility
  teamA?: (string | Player)[];
  teamB?: (string | Player)[];
  scoreA?: number;
  scoreB?: number;
  scorerA?: string;
  scorerB?: string;
  assistA?: string;
  assistB?: string;
  ownGoalA?: string;
  ownGoalB?: string;
  yellowA?: string;
  yellowB?: string;
  redA?: string;
  redB?: string;
  
  // Financial data
  thu?: number;
  chi_total?: number;
  chi_trongtai?: number;
  chi_nuoc?: number;
  chi_san?: number;
}

interface PlayerStats {
  name: string;
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
  matches: number;
}

interface MonthlyStats {
  month: string;
  totalMatches: number;
  totalGoals: number;
  totalAssists: number;
  totalOwnGoals: number;
  totalYellowCards: number;
  totalRedCards: number;
  topScorer: PlayerStats | null;
  topAssist: PlayerStats | null;
  playerStats: PlayerStats[];
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid mt-3">
      <!-- Gradient header removed to avoid duplicate page hero (tabs now provide context) -->

      <!-- Quick Stats Overview Table -->
      <div class="row mb-4">
        <div class="col-12">
          <div class="stats-overview-grid">
            <div class="stats-overview-card matches-card">
              <div class="card-icon-wrapper matches">
                <div class="card-icon">⚽</div>
                <div class="icon-glow"></div>
              </div>
              <div class="card-content">
                <div class="card-label">Trận đấu</div>
                <div class="card-value">{{overallStats.totalMatches}}</div>
                <div class="card-status">
                  <span class="status-badge" 
                        [class.excellent]="overallStats.totalMatches > 20"
                        [class.good]="overallStats.totalMatches > 10 && overallStats.totalMatches <= 20"
                        [class.average]="overallStats.totalMatches <= 10">
                    {{getMatchesStatus()}}
                  </span>
                </div>
              </div>
              <div class="card-decoration"></div>
            </div>

            <div class="stats-overview-card goals-card">
              <div class="card-icon-wrapper goals">
                <div class="card-icon">🥅</div>
                <div class="icon-glow"></div>
              </div>
              <div class="card-content">
                <div class="card-label">Bàn thắng</div>
                <div class="card-value">{{overallStats.totalGoals}}</div>
                <div class="card-subtitle">
                  <i class="fas fa-chart-line"></i>
                  {{(overallStats.totalGoals / overallStats.totalMatches || 0).toFixed(1)}} / trận
                </div>
              </div>
              <div class="card-decoration"></div>
            </div>

            <div class="stats-overview-card assists-card">
              <div class="card-icon-wrapper assists">
                <div class="card-icon">🎯</div>
                <div class="icon-glow"></div>
              </div>
              <div class="card-content">
                <div class="card-label">Kiến tạo</div>
                <div class="card-value">{{overallStats.totalAssists}}</div>
                <div class="card-subtitle">
                  <i class="fas fa-handshake"></i>
                  {{(overallStats.totalAssists / overallStats.totalMatches || 0).toFixed(1)}} / trận
                </div>
              </div>
              <div class="card-decoration"></div>
            </div>

            <div class="stats-overview-card cards-card">
              <div class="card-icon-wrapper cards">
                <div class="card-icon">🟨</div>
                <div class="icon-glow"></div>
              </div>
              <div class="card-content">
                <div class="card-label">Thẻ phạt</div>
                <div class="card-value">{{overallStats.totalYellowCards + overallStats.totalRedCards}}</div>
                <div class="card-subtitle">
                  <span class="yellow-text">🟨 {{overallStats.totalYellowCards}}</span>
                  <span class="separator">|</span>
                  <span class="red-text">🟥 {{overallStats.totalRedCards}}</span>
                </div>
              </div>
              <div class="card-decoration"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Head-to-Head Section removed (duplicate of AI analysis context) -->

      <!-- Filter Controls -->
      <div class="row mb-4">
        <div class="col-12">
          <div class="enhanced-filter-card">
            <div class="enhanced-filter-header">
              <div class="filter-title-section">
                <i class="fas fa-filter filter-icon"></i>
                <span>🎯 Bộ lọc & Sắp xếp</span>
              </div>
            </div>
            <div class="enhanced-filter-body">
              <div class="filter-row">
                <div class="filter-group">
                  <label class="enhanced-filter-label" for="viewModeSelect">
                    <i class="fas fa-eye label-icon"></i>
                    Xem theo
                  </label>
                  <div class="enhanced-select-wrapper">
                    <select id="viewModeSelect" class="enhanced-select" [(ngModel)]="viewMode" (change)="updateStats()">
                      <option value="all">🌍 Tất cả thời gian</option>
                      <option value="monthly">📅 Theo tháng</option>
                    </select>
                    <i class="fas fa-chevron-down enhanced-select-arrow"></i>
                  </div>
                </div>
                
                <div class="filter-group" *ngIf="viewMode === 'monthly'">
                  <label class="enhanced-filter-label" for="monthSelect">
                    <i class="fas fa-calendar label-icon"></i>
                    Chọn tháng
                  </label>
                  <div class="enhanced-select-wrapper">
                    <select id="monthSelect" class="enhanced-select" [(ngModel)]="selectedMonth" (change)="updateStats()">
                      <option value="">-- Chọn tháng --</option>
                      <option *ngFor="let month of availableMonths" [value]="month">{{formatMonth(month)}}</option>
                    </select>
                    <i class="fas fa-chevron-down enhanced-select-arrow"></i>
                  </div>
                </div>
                
                <div class="filter-group">
                  <label class="enhanced-filter-label" for="sortBySelect">
                    <i class="fas fa-sort label-icon"></i>
                    Sắp xếp theo
                  </label>
                  <div class="enhanced-select-wrapper">
                    <select id="sortBySelect" class="enhanced-select" [(ngModel)]="sortBy" (change)="updateStats()">
                      <option value="score">⭐ Điểm số</option>
                      <option value="goals">⚽ Bàn thắng</option>
                      <option value="assists">🎯 Kiến tạo</option>
                      <option value="ownGoals">🔴 Phản lưới</option>
                      <option value="yellowCards">🟨 Thẻ vàng</option>
                      <option value="redCards">🟥 Thẻ đỏ</option>
                      <option value="matches">🏟️ Số trận</option>
                    </select>
                    <i class="fas fa-chevron-down enhanced-select-arrow"></i>
                  </div>
                </div>
                
                <div class="filter-group status-group">
                  <div class="enhanced-filter-label">
                    <i class="fas fa-info-circle label-icon"></i>
                    Tình trạng
                  </div>
                  <div class="status-display">
                    <div class="status-badge-display">
                      <i class="fas fa-check-circle status-icon"></i>
                      <span>Đã cập nhật</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics Content -->
      <div *ngIf="history.length; else noData">
        <!-- Monthly Stats View -->
        <div *ngIf="viewMode === 'monthly' && selectedMonth" class="mb-4">
          <div class="monthly-stats-card">
            <div class="monthly-header">
              <h4 class="mb-0">
                <i class="fas fa-calendar-alt me-2"></i>
                📅 Thống kê tháng {{formatMonth(selectedMonth)}}
              </h4>
            </div>
            <div class="monthly-body">
              <div class="row g-3">
                <div class="col-lg-2 col-md-4 col-6">
                  <div class="monthly-stat">
                    <div class="monthly-stat-icon matches">⚽</div>
                    <div class="monthly-stat-value">{{monthlyStats[selectedMonth]?.totalMatches || 0}}</div>
                    <div class="monthly-stat-label">Trận đấu</div>
                  </div>
                </div>
                <div class="col-lg-2 col-md-4 col-6">
                  <div class="monthly-stat">
                    <div class="monthly-stat-icon goals">🥅</div>
                    <div class="monthly-stat-value">{{monthlyStats[selectedMonth]?.totalGoals || 0}}</div>
                    <div class="monthly-stat-label">Bàn thắng</div>
                  </div>
                </div>
                <div class="col-lg-2 col-md-4 col-6">
                  <div class="monthly-stat">
                    <div class="monthly-stat-icon assists">🎯</div>
                    <div class="monthly-stat-value">{{monthlyStats[selectedMonth]?.totalAssists || 0}}</div>
                    <div class="monthly-stat-label">Kiến tạo</div>
                  </div>
                </div>
                <div class="col-lg-2 col-md-4 col-6">
                  <div class="monthly-stat">
                    <div class="monthly-stat-icon yellow">🟨</div>
                    <div class="monthly-stat-value">{{monthlyStats[selectedMonth]?.totalYellowCards || 0}}</div>
                    <div class="monthly-stat-label">Thẻ vàng</div>
                  </div>
                </div>
                <div class="col-lg-2 col-md-4 col-6">
                  <div class="monthly-stat">
                    <div class="monthly-stat-icon red">🟥</div>
                    <div class="monthly-stat-value">{{monthlyStats[selectedMonth]?.totalRedCards || 0}}</div>
                    <div class="monthly-stat-label">Thẻ đỏ</div>
                  </div>
                </div>
                <div class="col-lg-2 col-md-4 col-6">
                  <div class="monthly-stat">
                    <div class="monthly-stat-icon total">📊</div>
                    <div class="monthly-stat-value">{{(monthlyStats[selectedMonth]?.totalGoals || 0) + (monthlyStats[selectedMonth]?.totalAssists || 0)}}</div>
                    <div class="monthly-stat-label">Tổng điểm</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Player Statistics Table -->
        <div class="modern-table-card">
          <div class="table-header">
            <div class="d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center">
                <h4 class="mb-0 me-2">
                  <i class="fas fa-users me-2"></i>
                  👥 Bảng xếp hạng cầu thủ
                  <small class="text-muted">
                    <i class="fas fa-calculator me-1"></i>
                    Điểm số = (Bàn thắng × 2) + (Kiến tạo × 1) + (Số trận × 1) - (Phản lưới × 2) - (Thẻ vàng × 1) - (Thẻ đỏ × 2)
                  </small>
                  </h4>
              </div>
              <div class="table-badge" *ngIf="enhancedStats">
              </div>
            </div>
          </div>
          <div class="table-body">
            <div class="table-responsive">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th class="rank-col">#</th>
                    <th class="player-col">
                      <i class="fas fa-user me-1"></i>
                      Cầu thủ
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-futbol me-1"></i>
                      Bàn thắng
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-crosshairs me-1"></i>
                      Kiến tạo
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-circle text-danger me-1"></i>
                      Phản lưới
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-square text-warning me-1"></i>
                      Thẻ vàng
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-square text-danger me-1"></i>
                      Thẻ đỏ
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-calendar-check me-1"></i>
                      Số trận
                    </th>
                    <th class="score-col">
                      <i class="fas fa-star me-1"></i>
                      Điểm số
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let player of getCurrentPlayerStats(); let i = index" 
                      class="player-row"
                      [class.rank-1]="getGlobalRank(i) === 1" 
                      [class.rank-2]="getGlobalRank(i) === 2" 
                      [class.rank-3]="getGlobalRank(i) === 3">
                    <td class="rank-cell">
                      <div class="rank-badge" [class.gold]="getGlobalRank(i) === 1" [class.silver]="getGlobalRank(i) === 2" [class.bronze]="getGlobalRank(i) === 3">
                        <span *ngIf="getGlobalRank(i) === 1">🥇</span>
                        <span *ngIf="getGlobalRank(i) === 2">🥈</span>
                        <span *ngIf="getGlobalRank(i) === 3">🥉</span>
                        <span *ngIf="getGlobalRank(i) > 3">{{getGlobalRank(i)}}</span>
                      </div>
                    </td>
                    <td class="player-cell">
                      <div class="player-info">
                        <div class="player-avatar">
                          <img [src]="getPlayerAvatar(player.name)" 
                               [alt]="player.name"
                               class="avatar-img"
                               (error)="onImageError($event)">
                        </div>
                        <div class="player-name">{{player.name}}</div>
                      </div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value goals" *ngIf="player.goals > 0">{{player.goals}}</div>
                      <div class="stat-empty" *ngIf="player.goals === 0">-</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value assists" *ngIf="player.assists > 0">{{player.assists}}</div>
                      <div class="stat-empty" *ngIf="player.assists === 0">-</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value own-goals" *ngIf="player.ownGoals > 0">{{player.ownGoals}}</div>
                      <div class="stat-empty" *ngIf="player.ownGoals === 0">-</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value yellow" *ngIf="player.yellowCards > 0">{{player.yellowCards}}</div>
                      <div class="stat-empty" *ngIf="player.yellowCards === 0">-</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value red" *ngIf="player.redCards > 0">{{player.redCards}}</div>
                      <div class="stat-empty" *ngIf="player.redCards === 0">-</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value matches">{{player.matches}}</div>
                    </td>
                    <td class="score-cell">
                      <div class="score-badge" [class.high-score]="calculatePlayerScore(player) > 10" 
                           [class.medium-score]="calculatePlayerScore(player) > 5 && calculatePlayerScore(player) <= 10"
                           [class.low-score]="calculatePlayerScore(player) <= 5">
                        {{calculatePlayerScore(player).toFixed(1)}}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Pagination Controls -->
            <div class="pagination-section" *ngIf="totalPages > 1">
              <div class="pagination-info">
                <ng-container *ngIf="getPaginationInfo() as pagination">
                  <span class="text-muted">
                    Hiển thị {{ pagination.start }}-{{ pagination.end }} 
                    trong tổng số {{ pagination.total }} cầu thủ
                  </span>
                </ng-container>
              </div>
              
              <div class="pagination-controls">
                <button 
                  class="btn btn-sm btn-outline-primary"
                  [disabled]="currentPage === 0"
                  (click)="previousPage()"
                  title="Trang trước">
                  <i class="fas fa-chevron-left"></i>
                </button>
                
                <span class="pagination-info mx-3">
                  Trang {{ currentPage + 1 }} / {{ totalPages }}
                </span>
                
                <button 
                  class="btn btn-sm btn-outline-primary"
                  [disabled]="currentPage >= totalPages - 1"
                  (click)="nextPage()"
                  title="Trang sau">
                  <i class="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Monthly Comparison (All Time View) -->
        <div *ngIf="viewMode === 'all'" class="modern-table-card mt-4">
          <div class="table-header">
            <div class="d-flex justify-content-between align-items-center">
              <h4 class="mb-0">
                <i class="fas fa-calendar-alt me-2"></i>
                📈 So sánh theo tháng
              </h4>
            </div>
          </div>
          <div class="table-body">
            <div class="table-responsive">
              <table class="modern-monthly-table">
                <thead>
                  <tr>
                    <th class="month-col">
                      <i class="fas fa-calendar me-1"></i>
                      Tháng
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-trophy me-1"></i>
                      Trận đấu
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-futbol me-1"></i>
                      Bàn thắng
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-crosshairs me-1"></i>
                      Kiến tạo
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-times-circle text-danger me-1"></i>
                      Phản lưới
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-square text-warning me-1"></i>
                      Thẻ vàng
                    </th>
                    <th class="stat-col">
                      <i class="fas fa-square text-danger me-1"></i>
                      Thẻ đỏ
                    </th>
                    <th class="player-col">
                      <i class="fas fa-crown me-1"></i>
                      Vua phá lưới
                    </th>
                    <th class="player-col">
                      <i class="fas fa-star me-1"></i>
                      Vua kiến tạo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let month of availableMonths; let i = index" 
                      class="monthly-row"
                      [class.highlight-row]="i === 0">
                    <td class="month-cell">
                      <div class="month-info">
                        <div class="month-name">{{formatMonth(month)}}</div>
                        <div class="month-year">{{getMonthYear(month)}}</div>
                      </div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value matches">{{monthlyStats[month]?.totalMatches || 0}}</div>
                      <div class="stat-label">trận</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value goals">{{monthlyStats[month]?.totalGoals || 0}}</div>
                      <div class="stat-label">bàn</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value assists">{{monthlyStats[month]?.totalAssists || 0}}</div>
                      <div class="stat-label">kiến tạo</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value own-goals">{{monthlyStats[month]?.totalOwnGoals || 0}}</div>
                      <div class="stat-label">phản lưới</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value yellow">{{monthlyStats[month]?.totalYellowCards || 0}}</div>
                      <div class="stat-label">thẻ vàng</div>
                    </td>
                    <td class="stat-cell">
                      <div class="stat-value red">{{monthlyStats[month]?.totalRedCards || 0}}</div>
                      <div class="stat-label">thẻ đỏ</div>
                    </td>
                    <td class="player-cell">
                      <div class="player-achievement" *ngIf="monthlyStats[month]?.topScorer; else noPlayer">
                        <div class="player-avatar-wrapper">
                          <img [src]="getPlayerAvatar(monthlyStats[month]?.topScorer?.name!)" 
                               [alt]="monthlyStats[month]?.topScorer?.name"
                               class="monthly-avatar"
                               (error)="onImageError($event)">
                          <div class="achievement-badge goals-badge">{{monthlyStats[month]?.topScorer?.goals}}</div>
                        </div>
                        <div class="player-name-small">{{monthlyStats[month]?.topScorer?.name}}</div>
                      </div>
                      <ng-template #noPlayer>
                        <div class="no-data">Chưa có</div>
                      </ng-template>
                    </td>
                    <td class="player-cell">
                      <div class="player-achievement" *ngIf="monthlyStats[month]?.topAssist; else noPlayer2">
                        <div class="player-avatar-wrapper">
                          <img [src]="getPlayerAvatar(monthlyStats[month]?.topAssist?.name!)" 
                               [alt]="monthlyStats[month]?.topAssist?.name"
                               class="monthly-avatar"
                               (error)="onImageError($event)">
                          <div class="achievement-badge assists-badge">{{monthlyStats[month]?.topAssist?.assists}}</div>
                        </div>
                        <div class="player-name-small">{{monthlyStats[month]?.topAssist?.name}}</div>
                      </div>
                      <ng-template #noPlayer2>
                        <div class="no-data">Chưa có</div>
                      </ng-template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>


      </div>

      <!-- No Data Template -->
      <ng-template #noData>
        <div class="no-data-card">
          <div class="no-data-icon">📊</div>
          <div class="no-data-title">Chưa có dữ liệu thống kê</div>
          <div class="no-data-text">
            Hãy chơi một vài trận đấu và lưu vào lịch sử để xem thống kê chi tiết tại đây!
            <br>
            <small class="text-muted mt-2 d-block">
              <i class="fas fa-info-circle me-1"></i>
              Thống kê sẽ tự động cập nhật từ dữ liệu "Xem Lịch Sử"
            </small>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .container-fluid {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Header Styles */
    /* stats-header styles removed */

    /* Stats Overview Grid - Modern Card Design */
    .stats-overview-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-bottom: 20px;
      animation: fadeInUp 0.6s ease;
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

    .stats-overview-card {
      position: relative;
      background: white;
      border-radius: 20px;
      padding: 28px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid transparent;
    }

    .stats-overview-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
    }

    .stats-overview-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, var(--card-color-1), var(--card-color-2));
      transition: height 0.3s ease;
    }

    .stats-overview-card:hover::before {
      height: 8px;
    }

    .matches-card {
      --card-color-1: #11998e;
      --card-color-2: #38ef7d;
    }

    .goals-card {
      --card-color-1: #ff6b6b;
      --card-color-2: #ee5a6f;
    }

    .assists-card {
      --card-color-1: #4facfe;
      --card-color-2: #00f2fe;
    }

    .cards-card {
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

    .stats-overview-card:hover .card-decoration {
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

    .stats-overview-card:hover .card-icon-wrapper {
      transform: scale(1.1) rotate(-5deg);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
    }

    .card-icon {
      font-size: 2.2rem;
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
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
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
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--card-color-1), var(--card-color-2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 12px;
      line-height: 1;
    }

    .card-status {
      margin-top: 12px;
    }

    .card-status .status-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, var(--card-color-1), var(--card-color-2));
      color: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .status-badge.excellent {
      background: linear-gradient(135deg, #27ae60, #2ecc71) !important;
    }

    .status-badge.good {
      background: linear-gradient(135deg, #f39c12, #f1c40f) !important;
    }

    .status-badge.average {
      background: linear-gradient(135deg, #95a5a6, #bdc3c7) !important;
    }

    .card-subtitle {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      color: #7f8c8d;
      font-weight: 600;
      margin-top: 8px;
    }

    .card-subtitle i {
      color: var(--card-color-1);
    }

    .yellow-text {
      color: #f39c12;
      font-weight: 700;
    }

    .red-text {
      color: #e74c3c;
      font-weight: 700;
    }

    .separator {
      color: #bdc3c7;
      font-weight: 400;
    }

    /* Modern Filter Card with Glassmorphism */
    .enhanced-filter-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px) saturate(180%);
      border-radius: 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      margin-bottom: 24px;
      animation: slideDown 0.5s ease;
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

    .enhanced-filter-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1.5rem 2rem;
      color: white;
      font-weight: 700;
      font-size: 1.1rem;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .filter-title-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .filter-icon {
      font-size: 1.3rem;
      animation: pulse 2s ease-in-out infinite;
    }

    .enhanced-filter-body {
      padding: 2rem;
      background: linear-gradient(180deg, rgba(248, 250, 252, 0.5) 0%, rgba(255, 255, 255, 0.8) 100%);
    }

    .filter-row {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .filter-group {
      flex: 1;
      min-width: 200px;
    }

    .enhanced-filter-label {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.85rem;
      font-weight: 700;
      color: #4a5568;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.75rem;
      padding: 0.5rem 0;
      position: relative;
    }

    .label-icon {
      color: #667eea;
      font-size: 1.1rem;
      transition: all 0.3s ease;
    }

    .enhanced-filter-label:hover .label-icon {
      color: #764ba2;
      transform: scale(1.15) rotate(5deg);
    }

    /* Modern Select Styling */
    .enhanced-select-wrapper {
      position: relative;
      margin-bottom: 0.5rem;
    }

    .enhanced-select {
      width: 100%;
      height: 52px;
      padding: 0.875rem 3rem 0.875rem 1.25rem;
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      background: white;
      font-size: 0.95rem;
      font-weight: 600;
      color: #2d3748;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      appearance: none;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .enhanced-select:hover {
      background: #f7fafc;
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
    }

    .enhanced-select:focus {
      outline: none;
      background: white;
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1), 
                  0 4px 16px rgba(102, 126, 234, 0.2);
      transform: translateY(-2px);
    }

    .enhanced-select-arrow {
      position: absolute;
      right: 1.25rem;
      top: 50%;
      transform: translateY(-50%);
      color: #667eea;
      font-size: 0.9rem;
      pointer-events: none;
      transition: all 0.3s ease;
    }

    .enhanced-select:hover + .enhanced-select-arrow,
    .enhanced-select:focus + .enhanced-select-arrow {
      color: #764ba2;
      transform: translateY(-50%) scale(1.2);
    }

    /* Status Badge Display */
    .status-group {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }

    .status-display {
      display: flex;
      align-items: center;
      height: 52px;
    }

    .status-badge-display {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      border-radius: 14px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      font-weight: 700;
      font-size: 0.9rem;
      box-shadow: 0 4px 16px rgba(17, 153, 142, 0.3);
      animation: pulse 2s ease-in-out infinite;
    }

    .status-icon {
      font-size: 1.1rem;
      animation: spin 3s linear infinite;
    }

    @keyframes spin {
      0%, 90% {
        transform: rotate(0deg);
      }
      95% {
        transform: rotate(360deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .enhanced-select:focus + .enhanced-select-arrow {
      color: #667eea;
      transform: translateY(-50%) rotate(180deg) scale(1.1);
      text-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
    }

    .enhanced-select:hover + .enhanced-select-arrow {
      color: #42a5f5;
      transform: translateY(-50%) scale(1.05);
      text-shadow: 0 2px 4px rgba(66, 165, 245, 0.3);
    }

    /* Status Display - Match enhanced-select-wrapper behavior */
    .status-display {
      position: relative;
      margin-bottom: 0.25rem;
      display: flex;
      align-items: center;
    }

    .status-badge-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #e8f5e8 0%, #f0fff0 100%);
      color: #27ae60;
      padding: 1.25rem 1.5rem;
      border-radius: 18px; /* Match enhanced-select border-radius */
      font-weight: 600;
      font-size: 1rem;
      border: 3px solid transparent;
      background-image: linear-gradient(135deg, #e8f5e8 0%, #f0fff0 100%), 
                        linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
      height: 58px; /* Match enhanced-select height */
      min-height: 58px;
      width: 100%;
      box-sizing: border-box;
      background-origin: border-box;
      background-clip: content-box, border-box;
      box-shadow: 0 4px 20px rgba(39, 174, 96, 0.15);
      height: 58px;
      min-height: 58px;
    }

    .status-icon {
      color: #27ae60;
      font-size: 1rem;
    }

    /* Monthly Stats Card */
    .monthly-stats-card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.08);
      overflow: hidden;
      margin-bottom: 2rem;
    }

    .monthly-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1.5rem;
      color: white;
    }

    .monthly-body {
      padding: 2rem;
    }

    .monthly-stat {
      text-align: center;
      padding: 1.5rem 1rem;
      border-radius: 15px;
      background: white;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      transition: all 0.3s ease;
    }

    .monthly-stat:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    }

    .monthly-stat-icon {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .monthly-stat-value {
      font-size: 2rem;
      font-weight: 800;
      color: #000000;
      margin-bottom: 0.25rem;
    }

    .monthly-stat-label {
      font-size: 0.9rem;
      color: #7f8c8d;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Modern Enhanced Table */
    .modern-table-card {
      background: white;
      border-radius: 24px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      margin-bottom: 24px;
      border: 2px solid rgba(102, 126, 234, 0.1);
      transition: all 0.3s ease;
    }

    .modern-table-card:hover {
      box-shadow: 0 16px 56px rgba(0, 0, 0, 0.15);
      transform: translateY(-4px);
    }

    .table-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1.75rem 2rem;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .table-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.2), transparent);
      pointer-events: none;
    }

    .table-header h4 {
      position: relative;
      z-index: 1;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
    }

    .table-body {
      padding: 0;
    }

    .modern-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }

    .modern-table thead {
      position: sticky;
      top: 0;
      z-index: 10;
      background: white;
    }

    .modern-table th {
      padding: 1.25rem 1rem;
      background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
      color: #2c3e50;
      text-align: center;
      font-weight: 700;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 3px solid #667eea;
      position: relative;
    }

    .modern-table th::after {
      content: '';
      position: absolute;
      bottom: -3px;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .modern-table th:hover::after {
      opacity: 1;
    }

    .modern-table tbody tr {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-bottom: 1px solid #f1f3f5;
      background: white;
    }

    .modern-table tbody tr:hover {
      background: linear-gradient(90deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
      transform: scale(1.01);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
    }

    .modern-table td {
      padding: 1.25rem 1rem;
      text-align: center;
      vertical-align: middle;
      color: #495057;
      font-weight: 500;
    }

    .rank-cell {
      text-align: center;
      width: 80px;
    }

    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      font-weight: 800;
      font-size: 1.3rem;
      background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
      color: #495057;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      position: relative;
    }

    .rank-badge::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--rank-color-1, #e9ecef), var(--rank-color-2, #dee2e6));
      z-index: -1;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .rank-badge:hover::before {
      opacity: 0.5;
    }

    .rank-badge.gold {
      --rank-color-1: #ffd700;
      --rank-color-2: #ffed4e;
      background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
      color: #b7791f;
      box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);
      animation: goldShine 3s ease-in-out infinite;
    }

    @keyframes goldShine {
      0%, 100% {
        box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);
      }
      50% {
        box-shadow: 0 8px 28px rgba(255, 215, 0, 0.6);
      }
    }

    .rank-badge.silver {
      --rank-color-1: #c0c0c0;
      --rank-color-2: #d3d3d3;
      background: linear-gradient(135deg, #c0c0c0 0%, #d3d3d3 100%);
      color: #666;
      box-shadow: 0 6px 20px rgba(192, 192, 192, 0.4);
    }

    .rank-badge.bronze {
      --rank-color-1: #cd7f32;
      --rank-color-2: #d4934d;
      background: linear-gradient(135deg, #cd7f32 0%, #d4934d 100%);
      color: #8b4513;
      box-shadow: 0 6px 20px rgba(205, 127, 50, 0.4);
    }

    .player-cell {
      text-align: center !important;
      min-width: 200px;
    }

    .player-achievement {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .player-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .player-avatar {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      transition: all 0.3s ease;
      position: relative;
    }

    .player-avatar::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      z-index: -1;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .modern-table tbody tr:hover .player-avatar {
      transform: scale(1.1) rotate(5deg);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }

    .modern-table tbody tr:hover .player-avatar::before {
      opacity: 0.5;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .fallback-icon {
      display: flex !important;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: white;
      font-size: 1.5rem;
    }

    .player-avatar-wrapper {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .monthly-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .player-name {
      font-weight: 700;
      color: #2c3e50;
      font-size: 1.05rem;
      letter-spacing: 0.3px;
      transition: all 0.3s ease;
    }

    .modern-table tbody tr:hover .player-name {
      color: #667eea;
    }

    .stat-value {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 48px;
      height: 48px;
      border-radius: 24px;
      font-weight: 700;
      font-size: 1.1rem;
      color: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    }

    .stat-value:hover {
      transform: scale(1.15);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }

    .stat-value.goals {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    }

    .stat-value.assists {
      background: linear-gradient(135deg, #4fc3f7 0%, #29b6f6 100%);
    }

    .stat-value.own-goals {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    }

    .stat-value.yellow {
      background: #ffeb3b;
      color: #b7791f;
    }

    .stat-value.red {
      background: #f44336;
    }

    .stat-value.matches {
      background: #11998e;
    }

    .stat-empty {
      color: #bdc3c7;
      font-size: 1.2rem;
      font-weight: 300;
    }

    .score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 60px;
      height: 40px;
      border-radius: 20px;
      font-weight: 800;
      font-size: 1rem;
      color: white;
    }

    .score-badge.high-score {
      background: #27ae60;
    }

    .score-badge.medium-score {
      background: #f39c12;
    }

    .score-badge.low-score {
      background: #95a5a6;
    }

    .no-data-card {
      background: white;
      padding: 2rem;
      text-align: center;
    }

    /* Players Section Styles */
    .players-section-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .players-section-header {
      background: #6c5ce7;
      color: white;
      padding: 1.5rem 2rem;
    }

    .players-section-body {
      padding: 0;
    }

    .players-table-header {
      display: grid;
      grid-template-columns: 2fr 1.5fr 0.8fr 1fr 1fr 1.5fr;
      gap: 1rem;
      padding: 1rem 2rem;
      background: #f8f9fa;
      font-weight: 700;
      color: #2c3e50;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
    }

    .players-list {
      min-height: 400px;
    }

    .player-row-item {
      display: grid;
      grid-template-columns: 2fr 1.5fr 0.8fr 1fr 1fr 1.5fr;
      gap: 1rem;
      padding: 1rem 2rem;
      border-bottom: 1px solid #e9ecef;
      align-items: center;
      transition: background-color 0.2s ease;
    }

    .player-row-item:hover {
      background-color: #f8f9fa;
    }

    .player-info-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .player-avatar-wrapper {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .player-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .player-name {
      font-weight: 600;
      color: #2c3e50;
    }

    .position-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-goalkeeper {
      background: #e74c3c;
      color: white;
    }

    .badge-defender {
      background: #3498db;
      color: white;
    }

    .badge-midfielder {
      background: #9b59b6;
      color: white;
    }

    .badge-forward {
      background: #e67e22;
      color: white;
    }

    .badge-default {
      background: #95a5a6;
      color: white;
    }

    .player-age-cell,
    .player-height-cell,
    .player-weight-cell {
      color: #6c757d;
      font-weight: 500;
    }

    .player-actions-cell {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .view-btn {
      background: #3498db;
      color: white;
    }

    .view-btn:hover {
      background: #2980b9;
      transform: translateY(-1px);
    }

    .edit-btn {
      background: #27ae60;
      color: white;
    }

    .edit-btn:hover {
      background: #229954;
      transform: translateY(-1px);
    }

    .delete-btn {
      background: #e74c3c;
      color: white;
    }

    .delete-btn:hover {
      background: #c0392b;
      transform: translateY(-1px);
    }

    .player-pagination-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: #f8f9fa;
      border-top: 1px solid #e9ecef;
    }

    .player-pagination-info {
      font-size: 0.875rem;
      color: #6c757d;
    }

    .player-pagination-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* Pagination Styles */
    .pagination-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: #f8f9fa;
      border-top: 1px solid #e9ecef;
      border-radius: 0 0 12px 12px;
    }

    .pagination-info {
      font-size: 0.875rem;
      color: #6c757d;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .pagination-controls .btn {
      min-width: 40px;
      height: 36px;
      border-radius: 6px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .pagination-controls .btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .pagination-controls .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-info.mx-3 {
      font-weight: 600;
      color: #495057;
      white-space: nowrap;
    }

    /* Responsive - Simplified */

    @media (max-width: 768px) {
      .stats-overview-grid {
        grid-template-columns: 1fr;
      }

      .filter-row {
        flex-direction: column;
      }
      
      .player-avatar {
        width: 40px;
        height: 40px;
      }

      .player-avatar-wrapper {
        width: 35px;
        height: 35px;
      }

      .pagination-section {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .pagination-controls {
        justify-content: center;
      }

      .pagination-info {
        font-size: 0.8rem;
      }

      /* Player Section Mobile Styles */
      .players-table-header {
        display: none;
      }

      .player-row-item {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 12px;
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .player-info-cell {
        justify-content: flex-start;
      }

      .player-position-cell,
      .player-age-cell,
      .player-height-cell,
      .player-weight-cell {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .player-position-cell::before {
        content: "Position: ";
        font-weight: 600;
      }

      .player-age-cell::before {
        content: "Age: ";
        font-weight: 600;
      }

      .player-height-cell::before {
        content: "Height: ";
        font-weight: 600;
      }

      .player-weight-cell::before {
        content: "Weight: ";
        font-weight: 600;
      }

      .player-actions-cell {
        justify-content: center;
        margin-top: 8px;
      }

      .player-pagination-section {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .player-pagination-controls {
        justify-content: center;
      }
    }

    /* Monthly Table - Simplified */
    .modern-monthly-table {
      width: 100%;
      border-collapse: collapse;
    }

    .modern-monthly-table th {
      background: #667eea;
      color: white;
      padding: 8px;
    }

    .stat-cell {
      padding: 8px;
      text-align: center;
    }

    /* Responsive Monthly Table */
    @media (max-width: 1200px) {
      .modern-monthly-table {
        font-size: 0.85rem;
      }

      .month-cell, .stat-cell, .player-cell {
        padding: 12px 8px;
      }

      .stat-value {
        font-size: 1rem;
      }

      .player-cell {
        min-width: 120px;
      }
    }

    @media (max-width: 992px) {
      .modern-monthly-table thead th,
      .stat-cell, .player-cell {
        padding: 10px 6px;
      }

      .stat-value {
        font-size: 0.95rem;
      }

      .player-name {
        font-size: 0.8rem;
      }

      .achievement-value {
        font-size: 0.7rem;
      }
    }

    @media (max-width: 768px) {
      .modern-monthly-table {
        border-radius: 8px;
      }

      .modern-monthly-table thead th {
        padding: 8px 4px;
        font-size: 0.8rem;
      }

      .month-cell, .stat-cell, .player-cell {
        padding: 8px 4px;
      }

      .month-name {
        font-size: 0.85rem;
      }

      .month-year {
        font-size: 0.7rem;
      }

      .stat-value {
        font-size: 0.9rem;
      }

      .stat-label {
        font-size: 0.65rem;
      }

      .player-name {
        font-size: 0.75rem;
      }

      .achievement-value {
        font-size: 0.65rem;
      }
    }

    /* AI Analysis Styles */
    .ai-analysis-card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      border: 2px solid transparent;
      background-image: linear-gradient(white, white), 
                        linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      background-origin: border-box;
      background-clip: content-box, border-box;
    }

    .ai-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
    }

    .ai-subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.95rem;
    }

    .bg-gradient-ai {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border: none;
    }

    .ai-body {
      padding: 2rem;
    }

    .analysis-controls {
      background: #f8f9ff;
      border-radius: 15px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .team-selector {
      background: white;
      border-radius: 15px;
      padding: 1.5rem;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      border: 1px solid #e9ecef;
      height: 100%; /* Ensure equal height */
    }

    /* Force parallel layout for teams */
    .row.g-3 .col-md-6 {
      display: flex;
      flex-direction: column;
    }

    /* Ensure teams stay side by side on screens 576px and up */
    @media (min-width: 576px) {
      .row.g-3 {
        display: flex;
        flex-wrap: wrap;
      }
      
      .row.g-3 .col-md-6 {
        flex: 1;
        max-width: 50%;
        min-width: 0;
      }
    }



    .xanh-team {
      border-left: 4px solid #3498db;
    }

    .cam-team {
      border-left: 4px solid #f39c12;
    }

    .team-title {
      color: #2c3e50;
      font-weight: 700;
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }

    .vs-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .vs-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .btn-ai {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      border-radius: 25px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }

    .btn-ai:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      color: white;
    }

    .btn-ai:disabled {
      opacity: 0.7;
      transform: none;
    }

    /* Enhanced Analysis Button */
    .enhanced-analysis-btn {
      position: relative;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-weight: 700;
      padding: 1.5rem 2.5rem;
      border-radius: 30px;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
      overflow: hidden;
      min-height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .enhanced-analysis-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      transition: left 0.8s ease;
    }

    .enhanced-analysis-btn:hover::before {
      left: 100%;
    }

    .enhanced-analysis-btn:hover {
      transform: translateY(-4px) scale(1.05);
      box-shadow: 0 12px 48px rgba(102, 126, 234, 0.6);
      color: white;
    }

    .enhanced-analysis-btn:disabled {
      opacity: 0.5;
      transform: none;
      cursor: not-allowed;
    }

    .enhanced-analysis-btn.pulsing {
      animation: pulseAnalysis 2s infinite;
    }

    @keyframes pulseAnalysis {
      0% { 
        box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
        transform: scale(1);
      }
      50% { 
        box-shadow: 0 12px 48px rgba(102, 126, 234, 0.7);
        transform: scale(1.02);
      }
      100% { 
        box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
        transform: scale(1);
      }
    }

    .btn-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      position: relative;
      z-index: 2;
    }

    .btn-icon {
      font-size: 1.8rem;
      margin-bottom: 0.25rem;
    }

    .btn-text {
      font-size: 1.1rem;
      font-weight: 800;
      line-height: 1.2;
    }

    .btn-subtitle {
      font-size: 0.8rem;
      opacity: 0.9;
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0.5px;
    }

    .analysis-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: rgba(255,255,255,0.3);
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8));
      width: 30%;
      animation: progressAnalysis 2s linear infinite;
    }

    @keyframes progressAnalysis {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }

    /* Selection Status */
    .selection-status {
      background: rgba(255,255,255,0.9);
      border-radius: 15px;
      padding: 1rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.3);
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      font-size: 0.9rem;
      font-weight: 600;
      color: #6c757d;
      transition: all 0.3s ease;
    }

    .status-item.complete {
      color: #28a745;
    }

    .status-item i {
      width: 16px;
      text-align: center;
    }

    .quick-actions {
      border-top: 1px solid rgba(255,255,255,0.3);
      padding-top: 0.75rem;
      text-align: center;
    }

    .quick-actions .btn {
      border-radius: 20px;
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
      font-weight: 600;
    }

    /* Custom Dropdown Styles */
    .custom-select-dropdown {
      position: relative;
      width: 100%;
      margin-bottom: 1rem;
    }

    .select-header {
      background: white;
      border: 2px solid #e9ecef;
      border-radius: 10px;
      padding: 1rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 80px;
    }

    .select-header:hover, .select-header:focus {
      outline: none;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
    }

    .xanh-dropdown .select-header:hover, .xanh-dropdown.open .select-header {
      border-color: #3498db;
    }

    .cam-dropdown .select-header:hover, .cam-dropdown.open .select-header {
      border-color: #f39c12;
    }

    .custom-select-dropdown.open .select-header {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: transparent;
    }

    .selected-text {
      font-weight: 600;
      color: #2c3e50;
      flex: 1;
      line-height: 1.4;
    }

    .selected-text.has-selection {
      color: #27ae60;
      font-weight: 700;
    }

    .dropdown-arrow {
      color: #7f8c8d;
      transition: all 0.3s ease;
      margin-left: 1rem;
      font-size: 1.1rem;
    }

    .dropdown-arrow.rotated {
      transform: rotate(180deg);
      color: #3498db;
    }

    .cam-dropdown .dropdown-arrow.rotated {
      color: #f39c12;
    }

    .select-options {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 2px solid #e9ecef;
      border-top: none;
      border-radius: 0 0 10px 10px;
      min-height: 250px;
      max-height: 350px;
      overflow-y: auto;
      z-index: 1000;
    }

    .xanh-dropdown .select-options {
      border-color: #3498db;
    }

    .cam-dropdown .select-options {
      border-color: #f39c12;
    }

    .option-item {
      padding: 0.8rem 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid #f8f9fa;
      min-height: 45px;
    }

    .option-item:last-child {
      border-bottom: none;
    }

    .option-item:hover, .option-item:focus {
      outline: none;
    }

    .xanh-dropdown .option-item:hover {
      background: #e3f2fd;
    }

    .cam-dropdown .option-item:hover {
      background: #fff3e0;
    }

    .checkbox-container {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .checkbox-container i {
      font-size: 1.3rem;
    }

    .checkbox-container i.fa-check-square {
      color: #27ae60;
    }

    .checkbox-container i.fa-square {
      color: #bdc3c7;
    }

    .player-name {
      flex: 1;
      font-weight: 600;
      color: #2c3e50;
    }



    /* Team Layout Styles */
    .teams-container {
      background: #f8f9ff;
      border-radius: 15px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .teams-header {
      border-bottom: 1px solid #e9ecef;
      padding-bottom: 1rem;
      margin-bottom: 1rem;
    }

    .team-header-title {
      font-size: 1.3rem;
      font-weight: 600;
      margin: 0;
    }

    .team-label {
      font-weight: 600;
      margin-bottom: 1rem;
      text-align: center;
      padding: 0.5rem;
    }

    /* Basic Styles */
    .score-display {
      display: flex;
      gap: 1rem;
    }

    .ai-analysis-section {
      background: #667eea;
      padding: 1rem;
      color: white;
    }

    .team-selector {
      background: white;
      padding: 1rem;
    }

    .xanh-team {
      border-left: 3px solid #3498db;
    }

    .cam-team {
      border-left: 3px solid #f39c12;
    }

    @media (max-width: 768px) {
      .select-options {
        min-height: 200px;
      }
    }

    /* Stack teams vertically only on very small screens */
    @media (max-width: 575px) {
      .row.g-3 .col-md-6 {
        flex: none;
        max-width: 100%;
      }
      
      .team-selector {
        margin-bottom: 1rem;
      }
    }

    .factor-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #f8f9ff;
      border-radius: 8px;
      margin-bottom: 0.5rem;
    }

    .factor-item.positive {
      background: #e8f5e8;
      border-left: 3px solid #27ae60;
    }

    .factor-item.negative {
      background: #fef2f2;
      border-left: 3px solid #e74c3c;
    }

    .factor-name {
      font-weight: 600;
      color: #2c3e50;
    }

    .factor-impact {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .impact-value {
      font-weight: 700;
    }

    .metric-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
      text-align: center;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .metric-icon {
      font-size: 2rem;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .metric-content {
      flex: 1;
      text-align: left;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #000000;
    }

    .metric-label {
      color: #7f8c8d;
      font-size: 0.9rem;
    }

    .history-title {
      color: #2c3e50;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }

    .history-stats {
      background: white;
      border-radius: 15px;
      padding: 1.5rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }

    .history-stat {
      text-align: center;
      padding: 1rem;
    }

    .stat-number {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #000000;
    }

    .xanh-wins .stat-number {
      color: #3498db;
    }

    .cam-wins .stat-number {
      color: #f39c12;
    }

    .draws .stat-number {
      color: #95a5a6;
    }

    .total .stat-number {
      color: #2c3e50;
    }

    .stat-label {
      color: #7f8c8d;
      font-size: 0.9rem;
      font-weight: 500;
    }

    /* Preserve circle backgrounds and proper text colors for monthly stats */
    .modern-monthly-table .stat-value {
      color: white !important; /* Keep white text for colored circle backgrounds */
    }
    
    .modern-monthly-table .stat-label {
      color: #000000 !important; /* Black color for labels only */
    }

    .no-analysis {
      text-align: center;
      padding: 3rem 2rem;
      color: #7f8c8d;
    }

    .no-analysis-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .no-analysis-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .no-analysis-text {
      font-size: 0.95rem;
    }

    /* Modern Multi-Select Styling */
    .modern-multi-select {
      width: 100%;
      min-height: 140px;
      padding: 1rem;
      border: 3px solid transparent;
      border-radius: 16px;
      background: linear-gradient(white, white) padding-box;
      font-size: 0.95rem;
      font-weight: 500;
      color: #2c3e50;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 20px rgba(0,0,0,0.08), 
                  inset 0 1px 0 rgba(255,255,255,0.6);
      backdrop-filter: blur(10px);
      cursor: pointer;
    }

    .modern-multi-select:focus {
      outline: none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15), 
                  0 0 0 0.3rem rgba(102, 126, 234, 0.15),
                  inset 0 1px 0 rgba(255,255,255,0.8);
      transform: translateY(-2px);
    }

    .modern-multi-select:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(0,0,0,0.12), 
                  inset 0 1px 0 rgba(255,255,255,0.7);
    }

    .xanh-select {
      border-color: #3498db;
    }

    .cam-select {
      border-color: #f39c12;
    }

    .player-option {
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .player-option:hover {
      background: #f8f9fa;
    }

    .player-option:checked {
      background: #667eea;
      color: white;
    }

    .player-name {
      font-weight: 500;
      flex: 1;
    }



    .player-selection .form-label {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .vs-section {
      text-align: center;
      padding: 1rem;
    }

    /* Enhanced Button Styling */
    .btn-ai {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-weight: 700;
      padding: 1rem 2rem;
      border-radius: 25px;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      position: relative;
      overflow: hidden;
    }

    .btn-ai::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.6s;
    }

    .btn-ai:hover::before {
      left: 100%;
    }

    .btn-ai:hover {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
      color: white;
    }

    .btn-ai:disabled {
      opacity: 0.7;
      transform: none;
      cursor: not-allowed;
    }

    .btn-ai:disabled:hover {
      transform: none;
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    /* Collapse/Expand Styles */
    .stats-overview-header[role="button"]:hover,
    .table-header[role="button"]:hover {
      background-color: rgba(102, 126, 234, 0.05);
      transform: translateY(-1px);
    }

    .stats-overview-header[role="button"]:focus,
    .table-header[role="button"]:focus {
      outline: 2px solid #667eea;
      outline-offset: 2px;
      background-color: rgba(102, 126, 234, 0.1);
    }

    .stats-overview-header[role="button"],
    .table-header[role="button"] {
      transition: all 0.3s ease;
      border-radius: 8px;
      padding: 1rem;
      margin: -1rem;
    }

    .fa-chevron-down, .fa-chevron-up {
      transition: transform 0.3s ease;
      color: #667eea;
      font-size: 1.1em;
    }

    .collapse {
      transition: all 0.35s ease-in-out;
    }

    .show {
      transition: all 0.35s ease-in-out;
    }

    /* Accessibility improvements */
    [role="button"] {
      -webkit-user-select: none;
      -moz-user-select: none;
      user-select: none;
    }

    [role="button"]:hover .fa-chevron-down,
    [role="button"]:hover .fa-chevron-up {
      transform: scale(1.1);
      color: #5a67d8;
    }


  `]
})
export class StatsComponent implements OnInit, OnDestroy {
  // Core services
  private destroy$ = new Subject<void>();
  private readonly statisticsService = inject(StatisticsService);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly dataStore = inject(DataStoreService);
  private readonly firebaseService = inject(FirebaseService);

  // Legacy data for backward compatibility
  history: HistoryEntry[] = [];
  availableMonths: string[] = [];
  monthlyStats: Record<string, MonthlyStats> = {};
  overallStats = {
    totalMatches: 0,
    totalGoals: 0,
    totalAssists: 0,
    totalYellowCards: 0,
    totalRedCards: 0
  };
  
  // Core data
  coreMatchesData: MatchInfo[] = [];
  corePlayersData: PlayerInfo[] = [];
  enhancedStats: { playerStats: import('../../core/services/statistics.service').PlayerStatistics[], fundAnalytics: import('../../core/services/statistics.service').FundAnalytics | null, matchAnalytics: import('../../core/services/statistics.service').MatchAnalytics[] } | null = null;
  isLoadingStats = false;
  
  // UI State
  viewMode: 'all' | 'monthly' = 'all';
  selectedMonth = '';
  sortBy: 'score' | 'goals' | 'assists' | 'ownGoals' | 'yellowCards' | 'redCards' | 'matches' = 'score';
  
  // Pagination State
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  
  ngOnInit(): void {
    // Deferred statistics listener: ensure statistics Firebase node attaches only when Stats route active
    try { this.firebaseService.attachStatisticsListener?.(); } catch { /* optional */ }
    this.loadCoreData();
    this.loadHistory();
    // Subscribe to completed matches for head-to-head stats
    this.matchService.completedMatches$.pipe(takeUntil(this.destroy$)).subscribe(matches=>{
      this.coreMatchesData = matches || []; // keep core list fresh
      // Head-to-head computation removed
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCoreData() {
    try {
      this.isLoadingStats = true;
      
      // Subscribe to core services data
      this.matchService.matches$
        .pipe(takeUntil(this.destroy$))
        .subscribe(matches => {
          this.coreMatchesData = matches;
          // this.generateEnhancedStatistics(); // Removed: method does not exist
        });
      
      this.playerService.players$
        .pipe(takeUntil(this.destroy$))
        .subscribe(players => {
          this.corePlayersData = players;
        });
      
      // Subscribe to enhanced statistics
      this.statisticsService.getPlayerStatistics()
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoadingStats = false)
        )
        .subscribe(playerStats => {
          this.enhancedStats = {
            playerStats,
            fundAnalytics: null,
            matchAnalytics: []
          };
          console.log('\u2705 Enhanced statistics loaded from StatisticsService');
        });
      
    } catch (error) {
      console.error('Error loading core data:', error);
      this.isLoadingStats = false;
    }
  }

  private loadHistory() {
    try {
      // Use Firebase data like History component does
          console.log('🔄 Loading match history from Firebase (like History component)...');
      
  this.firebaseService.history$.subscribe({
        next: (historyData) => {
          console.log('📊 Received Firebase history data:', historyData.length, 'matches');
          
          // Quick test of the first match to see data format
          if (historyData.length > 0) {
            const firstMatch = historyData[0];
            console.log('🧪 First match raw data test:', {
              scorerA: firstMatch.scorerA,
              scorerAType: typeof firstMatch.scorerA,
              scorerAEmpty: !firstMatch.scorerA,
              scorerB: firstMatch.scorerB,
              scorerBType: typeof firstMatch.scorerB,
              scorerBEmpty: !firstMatch.scorerB,
              totalGoalsExpected: this.countStatOccurrences(firstMatch.scorerA) + this.countStatOccurrences(firstMatch.scorerB)
            });
          }          this.history = [...historyData]; // Create a copy
          this.history.sort((a, b) => {
            const dateA = new Date(a.date || '').getTime();
            const dateB = new Date(b.date || '').getTime();
            return dateB - dateA; // Newest first
          });
          
          console.log('📊 Stats component loaded Firebase history:', {
            parsedLength: this.history.length,
            firstMatch: this.history[0] || 'No matches',
            lastMatch: this.history[this.history.length - 1] || 'No matches',
            isArray: Array.isArray(this.history),
            dateRange: this.history.length > 0 ? {
              newest: this.history[0]?.date,
              oldest: this.history[this.history.length - 1]?.date
            } : 'No dates'
          });
          
          // Debug each match structure
          if (this.history.length > 0) {
            console.log(`🔍 First match structure:`, {
              hasTeamA: !!this.history[0].teamA,
              teamAType: typeof this.history[0].teamA,
              teamAIsArray: Array.isArray(this.history[0].teamA),
              teamALength: Array.isArray(this.history[0].teamA) ? this.history[0].teamA?.length : 'N/A',
              teamAValue: this.history[0].teamA,
              hasTeamB: !!this.history[0].teamB,
              teamBType: typeof this.history[0].teamB,
              teamBIsArray: Array.isArray(this.history[0].teamB),
              teamBLength: Array.isArray(this.history[0].teamB) ? this.history[0].teamB?.length : 'N/A',
              teamBValue: this.history[0].teamB,
              date: this.history[0].date,
              scorerA: this.history[0].scorerA,
              scorerB: this.history[0].scorerB,
              assistA: this.history[0].assistA,
              assistB: this.history[0].assistB,
              yellowA: this.history[0].yellowA,
              yellowB: this.history[0].yellowB,
              redA: this.history[0].redA,
              redB: this.history[0].redB,
              allKeys: Object.keys(this.history[0])
            });
          }
          
          this.updateStats(); // Calculate statistics
          
          // Force UI update
          setTimeout(() => {
            console.log('🔄 Statistics UI should now be updated with real data');
          }, 100);
        },
        error: (error) => {
          console.error('❌ Error loading matches from Firebase:', error);
          // Fallback to localStorage if Firebase fails
          this.loadHistoryFromLocalStorage();
        }
      });
    } catch (error) {
      console.error('❌ Error in loadHistory:', error);
      // Fallback to localStorage if Firebase fails
      this.loadHistoryFromLocalStorage();
    }
  }
  
  private loadHistoryFromLocalStorage() {
    try {
      console.log('🔄 Falling back to localStorage...');
      const matchHistoryData = localStorage.getItem('matchHistory') || '[]';
      this.history = JSON.parse(matchHistoryData);
      
      if (!Array.isArray(this.history)) {
        console.warn('⚠️ Match history is not an array, initializing as empty array');
        this.history = [];
      }
      
      console.log('📊 Loaded from localStorage:', this.history.length, 'matches');
      this.updateStats();
    } catch (error) {
      console.error('❌ Error loading from localStorage:', error);
      this.history = [];
    }
  }

  private calculateStats() {
    console.log('📊 calculateStats() called with history length:', this.history.length);
    if (!this.history.length) {
      console.warn('⚠️ No match history data available for stats calculation');
      // Reset stats to zero when no data
      this.overallStats = {
        totalMatches: 0,
        totalGoals: 0,
        totalAssists: 0,
        totalYellowCards: 0,
        totalRedCards: 0
      };
      this.availableMonths = [];
      this.monthlyStats = {};
      return;
    }

    // Group matches by month and calculate all stats
    const matchesByMonth: Record<string, MatchData[]> = {};
    const playerStatsAll: Record<string, PlayerStats> = {};

    // Ensure history is an array before iterating
    const history = Array.isArray(this.history) ? this.history : [];
    console.log('📊 Processing', history.length, 'matches for statistics...');

    for (const match of history) {
      console.log(`🔍 Processing match:`, {
        id: match.id,
        date: match.date,
        hasDate: !!match.date,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        scorerA: match.scorerA,
        scorerB: match.scorerB,
        assistA: match.assistA,
        assistB: match.assistB
      });
      
      // Robust month key derivation: do NOT skip matches without valid date; categorize under 'unknown'
      let monthKey: string;
      if (!match.date) {
        console.warn('⚠️ Match has no date, assigning monthKey="unknown"');
        monthKey = 'unknown';
      } else {
        const date = new Date(match.date);
        if (isNaN(date.getTime())) {
          console.warn('⚠️ Invalid date format, assigning monthKey="unknown" for date:', match.date);
          monthKey = 'unknown';
        } else {
          monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        }
      }
      console.log(`   Month key: ${monthKey}`);
      
      if (!matchesByMonth[monthKey]) {
        matchesByMonth[monthKey] = [];
      }
      matchesByMonth[monthKey].push(match);

      // Process all players in the match for overall stats
      let teamA = match.teamA || [];
      let teamB = match.teamB || [];
      
      // Ensure they are arrays
      if (!Array.isArray(teamA)) teamA = [];
      if (!Array.isArray(teamB)) teamB = [];
      
      const allPlayers = [...teamA, ...teamB];
      
      // Track unique player participation from team rosters
      const matchPlayerNames = new Set<string>();
      for (const player of allPlayers) {
        let playerName = '';
        if (typeof player === 'string') {
          playerName = (player as string).trim();
        } else if (player && typeof player === 'object' && 'firstName' in player && typeof (player as { firstName?: string }).firstName === 'string') {
          const playerObj = player as { firstName: string; lastName?: string };
          playerName = `${playerObj.firstName} ${playerObj.lastName || ''}`.trim();
        }
        if (!playerName) continue;
        matchPlayerNames.add(playerName);
        if (!playerStatsAll[playerName]) {
          playerStatsAll[playerName] = {
            name: playerName,
            goals: 0,
            assists: 0,
            ownGoals: 0,
            yellowCards: 0,
            redCards: 0,
            matches: 0
          };
        }
      }

      // Also track players mentioned in stat fields (scorers, assists, cards)
      const extractPlayerNames = (statField: string | undefined): string[] => {
        if (!statField) return [];
        const parts = String(statField).split(',');
        return parts.map(p => p.trim().replace(/\s*\(\d+\)$/, '').trim()).filter(Boolean);
      };
      const allStatPlayerNames = [
        ...extractPlayerNames(match.scorerA),
        ...extractPlayerNames(match.scorerB),
        ...extractPlayerNames(match.assistA),
        ...extractPlayerNames(match.assistB),
        ...extractPlayerNames(match.yellowA),
        ...extractPlayerNames(match.yellowB),
        ...extractPlayerNames(match.redA),
        ...extractPlayerNames(match.redB)
      ];
      allStatPlayerNames.forEach(playerName => {
        if (playerName && !matchPlayerNames.has(playerName)) {
          matchPlayerNames.add(playerName);
          if (!playerStatsAll[playerName]) {
            playerStatsAll[playerName] = {
              name: playerName,
              goals: 0,
              assists: 0,
              ownGoals: 0,
              yellowCards: 0,
              redCards: 0,
              matches: 0
            };
          }
        }
      });

      // Count match participation and individual stats for each unique player
      matchPlayerNames.forEach(playerName => {
        playerStatsAll[playerName].matches++;
        const goals = this.parsePlayerStatFromField(match.scorerA, playerName) + this.parsePlayerStatFromField(match.scorerB, playerName);
        const assists = this.parsePlayerStatFromField(match.assistA, playerName) + this.parsePlayerStatFromField(match.assistB, playerName);
        const ownGoals = this.parsePlayerStatFromField(match.ownGoalA, playerName) + this.parsePlayerStatFromField(match.ownGoalB, playerName);
        const yellows = this.parsePlayerStatFromField(match.yellowA, playerName) + this.parsePlayerStatFromField(match.yellowB, playerName);
        const reds = this.parsePlayerStatFromField(match.redA, playerName) + this.parsePlayerStatFromField(match.redB, playerName);
        playerStatsAll[playerName].goals += goals;
        playerStatsAll[playerName].assists += assists;
        playerStatsAll[playerName].ownGoals += ownGoals;
        playerStatsAll[playerName].yellowCards += yellows;
        playerStatsAll[playerName].redCards += reds;
      });
    }

    // Calculate monthly stats
    this.availableMonths = Object.keys(matchesByMonth).sort().reverse();
    
    for (const monthKey of this.availableMonths) {
      const monthMatches = matchesByMonth[monthKey];
      const monthPlayerStats: Record<string, PlayerStats> = {};
      
      let totalGoals = 0;
      let totalAssists = 0;
      let totalOwnGoals = 0;
      let totalYellowCards = 0;
      let totalRedCards = 0;

      for (const match of monthMatches) {
        let teamA = match.teamA || [];
        let teamB = match.teamB || [];
        
        // Ensure they are arrays
        if (!Array.isArray(teamA)) teamA = [];
        if (!Array.isArray(teamB)) teamB = [];
        
        const allPlayers = [...teamA, ...teamB];
        const matchPlayerNames = new Set<string>();
        
        // Track players in this match
        for (const player of allPlayers) {
          let playerName = '';
          
          if (typeof player === 'string') {
            // New format: player names are stored as strings
            playerName = (player as string).trim();
          } else if (player && typeof player === 'object' && 
                     'firstName' in player && typeof (player as { firstName?: string }).firstName === 'string') {
            // Old format: player objects with firstName/lastName
            const playerObj = player as { firstName: string; lastName?: string };
            playerName = `${playerObj.firstName} ${playerObj.lastName || ''}`.trim();
          }
          
          if (!playerName) continue;
          
          matchPlayerNames.add(playerName);
          
          if (!monthPlayerStats[playerName]) {
            monthPlayerStats[playerName] = {
              name: playerName,
              goals: 0,
              assists: 0,
              ownGoals: 0,
              yellowCards: 0,
              redCards: 0,
              matches: 0
            };
          }
        }

        // Fallback / augmentation: if one of the team arrays is missing OR
        // if stat fields contain players not listed in teamA/teamB, include them.
        // This fixes cases where the last record has only teamA and scorerB like
        // "Minh củi, Minh củi, Minh củi, Hiển" so their participation and stats are counted.
        const extractNames = (field?: string): string[] => {
          if (!field) return [];
          return String(field)
            .split(',')
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => part.replace(/\s*\(\d+\)$/,'').trim()); // remove (2) suffix
        };
        const statFieldNames = [
          ...extractNames(match.scorerA),
          ...extractNames(match.scorerB),
          ...extractNames(match.assistA),
          ...extractNames(match.assistB),
          ...extractNames(match.yellowA),
          ...extractNames(match.yellowB),
          ...extractNames(match.redA),
          ...extractNames(match.redB)
        ];
        for (const name of statFieldNames) {
          if (!name) continue;
          if (!matchPlayerNames.has(name)) {
            matchPlayerNames.add(name);
            if (!monthPlayerStats[name]) {
              monthPlayerStats[name] = {
                name,
                goals: 0,
                assists: 0,
                ownGoals: 0,
                yellowCards: 0,
                redCards: 0,
                matches: 0
              };
            }
          }
        }

        // Count participation and stats for each player
        matchPlayerNames.forEach(playerName => {
          monthPlayerStats[playerName].matches++;
          
          const goals = this.parsePlayerStatFromField(match.scorerA, playerName) + this.parsePlayerStatFromField(match.scorerB, playerName);
          const assists = this.parsePlayerStatFromField(match.assistA, playerName) + this.parsePlayerStatFromField(match.assistB, playerName);
          const ownGoals = this.parsePlayerStatFromField(match.ownGoalA, playerName) + this.parsePlayerStatFromField(match.ownGoalB, playerName);
          const yellows = this.parsePlayerStatFromField(match.yellowA, playerName) + this.parsePlayerStatFromField(match.yellowB, playerName);
          const reds = this.parsePlayerStatFromField(match.redA, playerName) + this.parsePlayerStatFromField(match.redB, playerName);
          
          monthPlayerStats[playerName].goals += goals;
          monthPlayerStats[playerName].assists += assists;
          monthPlayerStats[playerName].ownGoals += ownGoals;
          monthPlayerStats[playerName].yellowCards += yellows;
          monthPlayerStats[playerName].redCards += reds;
        });

        // Calculate total match stats with debugging
        const matchGoals = this.countStatOccurrences(match.scorerA) + this.countStatOccurrences(match.scorerB);
        const matchAssists = this.countStatOccurrences(match.assistA) + this.countStatOccurrences(match.assistB);
        const matchYellows = this.countStatOccurrences(match.yellowA) + this.countStatOccurrences(match.yellowB);
        const matchReds = this.countStatOccurrences(match.redA) + this.countStatOccurrences(match.redB);
        const matchOwnGoals = this.countStatOccurrences(match.ownGoalA) + this.countStatOccurrences(match.ownGoalB);
        
        console.log(`🔍 Match ${monthKey} stats:`, {
          date: match.date,
          scorerA: match.scorerA,
          scorerB: match.scorerB,
          assistA: match.assistA,
          assistB: match.assistB,
          ownGoalA: match.ownGoalA,
          ownGoalB: match.ownGoalB,
          yellowA: match.yellowA,
          yellowB: match.yellowB,
          redA: match.redA,
          redB: match.redB,
          calculatedGoals: matchGoals,
          calculatedAssists: matchAssists,
          calculatedOwnGoals: matchOwnGoals,
          calculatedYellows: matchYellows,
          calculatedReds: matchReds
        });
        
        totalGoals += matchGoals;
        totalAssists += matchAssists;
        totalOwnGoals += matchOwnGoals;
        totalYellowCards += matchYellows;
        totalRedCards += matchReds;
      }

      // Find top performers for the month
      const monthPlayers = Object.values(monthPlayerStats);
      // Tie-breaker logic for monthly leaders:
      // Top Scorer: highest goals; if tie, higher assists; if still tie, fewer cards; if still tie, higher matches; final tie -> alphabetical.
      const topScorer = monthPlayers
        .filter(p => p.goals > 0)
        .sort((a, b) => {
          if (b.goals !== a.goals) return b.goals - a.goals;
          if (b.assists !== a.assists) return b.assists - a.assists; // secondary contribution
          const aCards = a.yellowCards + a.redCards * 2;
          const bCards = b.yellowCards + b.redCards * 2;
          if (aCards !== bCards) return aCards - bCards; // prefer better discipline (fewer cards)
          if (b.matches !== a.matches) return b.matches - a.matches; // more participation
          return a.name.localeCompare(b.name, 'vi');
        })[0] || null;
      // Top Assist: highest assists; tie-break by player score (overall impact) then goals then discipline then matches then alphabetical.
      const topAssist = monthPlayers
        .filter(p => p.assists > 0)
        .sort((a, b) => {
          if (b.assists !== a.assists) return b.assists - a.assists;
          const scoreA = (a.goals * 2) + a.assists + a.matches - a.yellowCards - (a.redCards * 2);
          const scoreB = (b.goals * 2) + b.assists + b.matches - b.yellowCards - (b.redCards * 2);
          if (scoreB !== scoreA) return scoreB - scoreA; // higher overall score wins
          if (b.goals !== a.goals) return b.goals - a.goals; // offensive contribution
          const aCards = a.yellowCards + a.redCards * 2;
          const bCards = b.yellowCards + b.redCards * 2;
          if (aCards !== bCards) return aCards - bCards; // better discipline
          if (b.matches !== a.matches) return b.matches - a.matches; // more participation
          return a.name.localeCompare(b.name, 'vi');
        })[0] || null;

      this.monthlyStats[monthKey] = {
        month: monthKey,
        totalMatches: monthMatches.length,
        totalGoals,
        totalAssists,
        totalOwnGoals,
        totalYellowCards,
        totalRedCards,
        topScorer,
        topAssist,
        playerStats: monthPlayers
      };
    }

    // Calculate overall stats
    const allPlayersList = Object.values(playerStatsAll);
    
    // Also calculate totals from all matches directly
    const directTotalGoals = this.history.reduce((sum, match) => 
      sum + this.countStatOccurrences(match.scorerA) + this.countStatOccurrences(match.scorerB), 0);
    const directTotalAssists = this.history.reduce((sum, match) => 
      sum + this.countStatOccurrences(match.assistA) + this.countStatOccurrences(match.assistB), 0);
    const directTotalYellows = this.history.reduce((sum, match) => 
      sum + this.countStatOccurrences(match.yellowA) + this.countStatOccurrences(match.yellowB), 0);
    const directTotalReds = this.history.reduce((sum, match) => 
      sum + this.countStatOccurrences(match.redA) + this.countStatOccurrences(match.redB), 0);
    
    console.log('🔍 Stats comparison:', {
      fromPlayers: {
        goals: allPlayersList.reduce((sum, p) => sum + p.goals, 0),
        assists: allPlayersList.reduce((sum, p) => sum + p.assists, 0),
        yellows: allPlayersList.reduce((sum, p) => sum + p.yellowCards, 0),
        reds: allPlayersList.reduce((sum, p) => sum + p.redCards, 0)
      },
      fromMatches: {
        goals: directTotalGoals,
        assists: directTotalAssists,
        yellows: directTotalYellows,
        reds: directTotalReds
      }
    });
    
    this.overallStats = {
      totalMatches: this.history.length,
      totalGoals: directTotalGoals, // Use direct calculation instead of player aggregation
      totalAssists: directTotalAssists,
      totalYellowCards: directTotalYellows,
      totalRedCards: directTotalReds
    };

    // Debug: Check calculated stats
    console.log('📊 Statistics calculation complete:');
    console.log('   - Total matches:', this.overallStats.totalMatches);
    console.log('   - Total goals:', this.overallStats.totalGoals);
    console.log('   - Total assists:', this.overallStats.totalAssists);
    console.log('   - Total yellow cards:', this.overallStats.totalYellowCards);
    console.log('   - Total red cards:', this.overallStats.totalRedCards);
    console.log('   - Players count:', allPlayersList.length);
    console.log('   - Available months:', this.availableMonths.length);
    console.log('   - Sample player:', allPlayersList[0] || 'No players');
    
    // Debug sample monthly stats
    if (this.availableMonths.length > 0) {
      const firstMonth = this.availableMonths[0];
      console.log('📅 Sample monthly stats for', firstMonth, ':', this.monthlyStats[firstMonth]);
    }
  }

  private normalizeName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private parsePlayerStatFromField(statField: string | undefined, playerName: string): number {
    if (!statField || !playerName) return 0;
    
    const fieldStr = String(statField).trim();
    if (fieldStr === '') return 0;
    
    console.log(`🔍 Parsing field "${fieldStr}" for player "${playerName}"`);
    
    // Handle comma-separated names with counts
    const parts = fieldStr.split(',');
    let totalCount = 0;
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Extract the name part (without count in parentheses)
      const nameWithoutCount = trimmed.replace(/\s*\(\d+\)$/, '').trim();
      
      // Check for exact match
      if (this.isExactNameMatch(nameWithoutCount, playerName)) {
        // Extract number if any (e.g., "PlayerName (2)" -> 2)
        const countMatch = trimmed.match(/\((\d+)\)$/);
        const count = countMatch ? parseInt(countMatch[1]) : 1;
        totalCount += count;
      }
    }

    return totalCount;
  }

  private isExactNameMatch(fieldName: string, playerName: string): boolean {
    const normalizedFieldName = this.normalizeName(fieldName);
    const normalizedPlayerName = this.normalizeName(playerName);
    if (normalizedFieldName === normalizedPlayerName) return true;
    // Allow first-name only match if unique token
    const playerFirst = normalizedPlayerName.split(' ')[0];
    if (!normalizedFieldName.includes(' ') && normalizedFieldName === playerFirst) return true;
    const fieldParts = normalizedFieldName.split(' ');
    const playerParts = normalizedPlayerName.split(' ');
    if (fieldParts.length === playerParts.length) {
      return fieldParts.every((p, i) => p === playerParts[i]);
    }
    return false;
  }

  private countStatOccurrences(statField: string | undefined): number {
    if (!statField || statField.trim() === '') {
      return 0;
    }
    
    // Convert to string if it's not already
    const fieldStr = String(statField).trim();
    
    console.log('🔍 Counting occurrences in field:', `"${fieldStr}"`);
    
    // Count total occurrences in the field
    const parts = fieldStr.split(',');
    let total = 0;
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed && trimmed !== '') {
        // Extract number if any (e.g., "PlayerName (2)" -> 2), otherwise count as 1
        const match = trimmed.match(/\((\d+)\)/);
        const count = match ? parseInt(match[1]) : 1;
        total += count;
        console.log(`   Part: "${trimmed}" -> Count: ${count}`);
      }
    }
    
    console.log(`   Total count for "${fieldStr}": ${total}`);
    return total;
  }

  updateStats() {
    console.log('🔄 updateStats() called - triggering recalculation...');
    // Trigger recalculation if needed
    this.calculateStats();
    
    // Update pagination after stats calculation
    this.updatePagination();
  }
  
  private updatePagination() {
    const currentStats = this.getCurrentPlayerStats();
    this.totalPages = Math.ceil(currentStats.length / this.pageSize);
    
    // Reset to first page if current page is out of bounds
    if (this.currentPage >= this.totalPages) {
      this.currentPage = 0;
    }
  }

  getAllPlayerStats(): PlayerStats[] {
    let playerStats: PlayerStats[];
    
    if (this.viewMode === 'monthly' && this.selectedMonth && this.monthlyStats[this.selectedMonth]) {
      playerStats = this.monthlyStats[this.selectedMonth].playerStats;
    } else {
      // Overall stats - reconstruct from monthly data
      const allPlayers: Record<string, PlayerStats> = {};
      
      for (const monthData of Object.values(this.monthlyStats)) {
        for (const player of monthData.playerStats) {
          if (!allPlayers[player.name]) {
            allPlayers[player.name] = {
              name: player.name,
              goals: 0,
              assists: 0,
              ownGoals: 0,
              yellowCards: 0,
              redCards: 0,
              matches: 0
            };
          }
          
          allPlayers[player.name].goals += player.goals;
          allPlayers[player.name].assists += player.assists;
          allPlayers[player.name].ownGoals += player.ownGoals;
          allPlayers[player.name].yellowCards += player.yellowCards;
          allPlayers[player.name].redCards += player.redCards;
          allPlayers[player.name].matches += player.matches;
        }
      }
      
      playerStats = Object.values(allPlayers);
    }

    // Sort by selected criteria (descending order)
    return playerStats.sort((a, b) => {
      if (this.sortBy === 'score') return this.calculatePlayerScore(b) - this.calculatePlayerScore(a);
      if (this.sortBy === 'goals') return b.goals - a.goals;
      if (this.sortBy === 'assists') return b.assists - a.assists;
      if (this.sortBy === 'ownGoals') return b.ownGoals - a.ownGoals;
      if (this.sortBy === 'yellowCards') return b.yellowCards - a.yellowCards;
      if (this.sortBy === 'redCards') return b.redCards - a.redCards;
      if (this.sortBy === 'matches') return b.matches - a.matches;
      return 0;
    });
  }

  getCurrentPlayerStats(): PlayerStats[] {
    const allStats = this.getAllPlayerStats();
    this.totalPages = Math.ceil(allStats.length / this.pageSize);
    
    // Reset to first page if current page is beyond available pages
    if (this.currentPage >= this.totalPages && this.totalPages > 0) {
      this.currentPage = 0;
    }
    
    const startIndex = this.currentPage * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return allStats.slice(startIndex, endIndex);
  }

  // Pagination methods
  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
    }
  }

  getPaginationInfo(): { start: number; end: number; total: number } {
    const allStats = this.getAllPlayerStats();
    const start = this.currentPage * this.pageSize + 1;
    const end = Math.min((this.currentPage + 1) * this.pageSize, allStats.length);
    return { start, end, total: allStats.length };
  }

  calculatePlayerScore(player: PlayerStats): number {
    // Score calculation: (goals × 2) + (assists × 1) + (matches × 1) - (ownGoals × 2) - (yellowCards × 1) - (redCards × 2)
    return (player.goals * 2)
      + (player.assists * 1)
      + (player.matches * 1)
      - (player.ownGoals * 2)
      - (player.yellowCards * 1)
      - (player.redCards * 2);
  }

  getGlobalRank(localIndex: number): number {
    return (this.currentPage * this.pageSize) + localIndex + 1;
  }

  formatMonth(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('vi-VN', { month: 'long' });
  }

  getMonthYear(monthKey: string): string {
    const [year] = monthKey.split('-');
    return year;
  }

  trackByPlayerId(index: number, player: PlayerInfo): string {
    return player.id || index.toString();
  }

  getPositionBadgeClass(position: string): string {
    switch (position) {
      case 'Thủ môn':
        return 'badge-goalkeeper';
      case 'Hậu vệ':
        return 'badge-defender';
      case 'Tiền vệ':
        return 'badge-midfielder';
      case 'Tiền đạo':
        return 'badge-forward';
      default:
        return 'badge-default';
    }
  }

  getPositionDisplayName(position: string): string {
    switch (position) {
      case 'Thủ môn':
        return 'THỦ MÔN';
      case 'Hậu vệ':
        return 'HẬU VỆ';
      case 'Tiền vệ':
        return 'TIỀN VỆ';
      case 'Tiền đạo':
        return 'TIỀN ĐẠO';
      default:
        return position?.toUpperCase() || '';
    }
  }

  getPlayerAvatar(playerName: string): string {
    console.log(`Looking for avatar for: "${playerName}"`); // Debug log
    
    // Map player names to their avatar files
    const nameMap: Record<string, string> = {
      // Base names with various spellings
      'Sy': 'Sy.png',
      'Sỹ': 'Sy.png',
      'Trung': 'Trung.png',
      'Bình': 'Binh.png',
      'Binh': 'Binh.png',
      'Công': 'Cong.png',
      'Cong': 'Cong.png',
      'Cường': 'Cuong.png',
      'Cuong': 'Cuong.png',
      'Đ.Duy': 'D.Duy.png',
      'D.Duy': 'D.Duy.png',
      'Duy': 'D.Duy.png',
      'Định': 'Dinh.jpg',
      'Dinh': 'Dinh.jpg',
      'Dương': 'Duong.png',
      'Duong': 'Duong.png',
      'Dybala': 'Dybala.jpg',
      'Galvin': 'Galvin.png',
      'H.Thành': 'H.Thanh.png',
      'H.Thanh': 'H.Thanh.png',
      'Hà': 'Ha.png',
      'Ha': 'Ha.png',
      'Hải': 'Hai.png',
      'Hai': 'Hai.png',
      'Hải Lu': 'Hai_lu.png',
      'Hải Lưu': 'Hai_lu.png',
      'Hai Lu': 'Hai_lu.png',
      'Hai Lưu': 'Hai_lu.png',
      'Hai_lu': 'Hai_lu.png',
      'Hậu': 'Hau.png',
      'Hau': 'Hau.png',
      'Hiền': 'Hien.png',
      'Hien': 'Hien.png',
      'Hiển': 'Hien.png',
      'Hiếu': 'Hieu.png',
      'Hieu': 'Hieu.png',
      'Hòa': 'Hoa.png',
      'Hoà': 'Hoa.png',
      'Hoa': 'Hoa.png',
      'Hùng': 'Hung.png',
      'Hung': 'Hung.png',
      'Huy': 'Huy.png',
      'K.Duy': 'K.Duy.png',
      'Lâm': 'Lam.png',
      'Lam': 'Lam.png',
      'Lê': 'Le.png',
      'Le': 'Le.png',
      'Lộc': 'Loc.png',
      'Loc': 'Loc.png',
      'Minh Cui': 'Minh_cui.png',
      'Minh_cui': 'Minh_cui.png',
      'Minh củi': 'Minh_cui.png',
      'Minh Nhỏ': 'Minh_nho.jpg',
      'Minh_nho': 'Minh_nho.jpg',
      'Minh nhỏ': 'Minh_nho.jpg',
      'Nam': 'Nam.png',
      'Nhân': 'Nhan.png',
      'Nhan': 'Nhan.png',
      'Phú': 'Phu.png',
      'Phu': 'Phu.png',
      'Q.Thành': 'Q.Thanh.png',
      'Q.Thanh': 'Q.Thanh.png',
      'Quang': 'Quang.png',
      'Quý': 'Quy.png',
      'Quy': 'Quy.png',
      'T.Hải': 'T.Hai.png',
      'T.Hai': 'T.Hai.png',
      'Tân': 'Tan.png',
      'Tan': 'Tan.png',
      'Tây': 'Tay.png',
      'Tay': 'Tay.png',
      'Thắng': 'Thang.png',
      'Thang': 'Thang.png',
      'Thiện': 'Thien.png',
      'Thien': 'Thien.png',
      'V.Thành': 'V.Thanh.png',
      'V.Thanh': 'V.Thanh.png'
    };

    // First try exact match
    let fileName = nameMap[playerName];
    console.log(`Exact match result: ${fileName}`); // Debug log
    
    // If not found, try normalized matching (remove accents and standardize)
    if (!fileName) {
      // Normalize the input name (remove accents, convert to lowercase for comparison)
      const normalizedInput = playerName.toLowerCase()
        .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
        .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
        .replace(/[ìíịỉĩ]/g, 'i')
        .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
        .replace(/[ùúụủũưừứựửữ]/g, 'u')
        .replace(/[ỳýỵỷỹ]/g, 'y')
        .replace(/đ/g, 'd');
      
      console.log(`Normalized input: "${normalizedInput}"`); // Debug log

      // Try to find a match by normalizing all keys
      for (const [key, value] of Object.entries(nameMap)) {
        const normalizedKey = key.toLowerCase()
          .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
          .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
          .replace(/[ìíịỉĩ]/g, 'i')
          .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
          .replace(/[ùúụủũưừứựửữ]/g, 'u')
          .replace(/[ỳýỵỷỹ]/g, 'y')
          .replace(/đ/g, 'd');
        
        if (normalizedKey === normalizedInput) {
          fileName = value;
          console.log(`Normalized match found: ${key} -> ${value}`); // Debug log
          break;
        }
      }
    }
    
    // If still not found, try partial matching (first name only)
    if (!fileName) {
      const firstNameOnly = playerName.split(' ')[0];
      fileName = nameMap[firstNameOnly];
      console.log(`First name match for "${firstNameOnly}": ${fileName}`); // Debug log
    }
    
    const finalPath = fileName ? 
      `assets/images/avatar_players/${fileName}` : 
      `assets/images/avatar_players/${playerName.replace(/\s+/g, '_')}.png`;
    
    console.log(`Final avatar path: ${finalPath}`); // Debug log
    return finalPath;
  }

  onImageError(event: Event): void {
    // Fallback to a default icon if image fails to load
    const target = event.target as HTMLImageElement;
    const playerName = target.alt || 'Unknown';
    
    console.log(`Avatar not found for player: ${playerName}, attempted URL: ${target.src}`);
    
    target.style.display = 'none';
    const parent = target.parentNode as HTMLElement;
    if (parent && !parent.querySelector('.fallback-icon')) {
      const fallbackIcon = document.createElement('i');
      fallbackIcon.className = 'fas fa-user-circle fallback-icon';
      fallbackIcon.style.fontSize = '100%';
      fallbackIcon.style.color = '#667eea';
      fallbackIcon.style.display = 'flex';
      fallbackIcon.style.alignItems = 'center';
      fallbackIcon.style.justifyContent = 'center';
      fallbackIcon.style.width = '100%';
      fallbackIcon.style.height = '100%';
      fallbackIcon.title = `Avatar not available for ${playerName}`;
      parent.appendChild(fallbackIcon);
    }
  }

  getDisplayTitle(): string {
    if (this.viewMode === 'monthly' && this.selectedMonth) {
      return `Tháng ${this.formatMonth(this.selectedMonth)}`;
    }
    return 'Tất cả thời gian';
  }

  // Helper methods for status badges
  getMatchesStatus(): string {
    const total = this.overallStats.totalMatches;
    if (total > 20) return 'Nhiều kinh nghiệm';
    if (total > 10) return 'Có kinh nghiệm';
    return 'Mới bắt đầu';
  }

  getCardsStatus(): string {
    const totalCards = this.overallStats.totalYellowCards + this.overallStats.totalRedCards;
    if (totalCards > 20) return 'Cần cải thiện';
    if (totalCards > 10) return 'Bình thường';
    return 'Kỷ luật tốt';
  }

  getPlayerFromCore(playerName: string): PlayerInfo | undefined {
    return this.corePlayersData.find(player => 
      `${player.firstName} ${player.lastName || ''}`.trim() === playerName
    );
  }
}
