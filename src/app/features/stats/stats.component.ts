import { Component, OnInit, OnDestroy, inject } from '@angular/core';

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
  imports: [FormsModule],
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
    
                @if (viewMode === 'monthly') {
                  <div class="filter-group">
                    <label class="enhanced-filter-label" for="monthSelect">
                      <i class="fas fa-calendar label-icon"></i>
                      Chọn tháng
                    </label>
                    <div class="enhanced-select-wrapper">
                      <select id="monthSelect" class="enhanced-select" [(ngModel)]="selectedMonth" (change)="updateStats()">
                        <option value="">-- Chọn tháng --</option>
                        @for (month of availableMonths; track month) {
                          <option [value]="month">{{formatMonth(month)}}</option>
                        }
                      </select>
                      <i class="fas fa-chevron-down enhanced-select-arrow"></i>
                    </div>
                  </div>
                }
    
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
      @if (history.length) {
        <div>
          <!-- Monthly Stats View -->
          @if (viewMode === 'monthly' && selectedMonth) {
            <div class="mb-4">
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
          }
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
                @if (enhancedStats) {
                  <div class="table-badge">
                  </div>
                }
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
                    @for (player of getCurrentPlayerStats(); track player; let i = $index) {
                      <tr
                        class="player-row"
                        [class.rank-1]="getGlobalRank(i) === 1"
                        [class.rank-2]="getGlobalRank(i) === 2"
                        [class.rank-3]="getGlobalRank(i) === 3">
                        <td class="rank-cell">
                          <div class="rank-badge" [class.gold]="getGlobalRank(i) === 1" [class.silver]="getGlobalRank(i) === 2" [class.bronze]="getGlobalRank(i) === 3">
                            @if (getGlobalRank(i) === 1) {
                              <span>🥇</span>
                            }
                            @if (getGlobalRank(i) === 2) {
                              <span>🥈</span>
                            }
                            @if (getGlobalRank(i) === 3) {
                              <span>🥉</span>
                            }
                            @if (getGlobalRank(i) > 3) {
                              <span>{{getGlobalRank(i)}}</span>
                            }
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
                          @if (player.goals > 0) {
                            <div class="stat-value goals">{{player.goals}}</div>
                          }
                          @if (player.goals === 0) {
                            <div class="stat-empty">-</div>
                          }
                        </td>
                        <td class="stat-cell">
                          @if (player.assists > 0) {
                            <div class="stat-value assists">{{player.assists}}</div>
                          }
                          @if (player.assists === 0) {
                            <div class="stat-empty">-</div>
                          }
                        </td>
                        <td class="stat-cell">
                          @if (player.ownGoals > 0) {
                            <div class="stat-value own-goals">{{player.ownGoals}}</div>
                          }
                          @if (player.ownGoals === 0) {
                            <div class="stat-empty">-</div>
                          }
                        </td>
                        <td class="stat-cell">
                          @if (player.yellowCards > 0) {
                            <div class="stat-value yellow">{{player.yellowCards}}</div>
                          }
                          @if (player.yellowCards === 0) {
                            <div class="stat-empty">-</div>
                          }
                        </td>
                        <td class="stat-cell">
                          @if (player.redCards > 0) {
                            <div class="stat-value red">{{player.redCards}}</div>
                          }
                          @if (player.redCards === 0) {
                            <div class="stat-empty">-</div>
                          }
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
                    }
                  </tbody>
                </table>
              </div>
              <!-- Pagination Controls -->
              @if (totalPages > 1) {
                <div class="pagination-section">
                  <div class="pagination-info">
                    @if (getPaginationInfo(); as pagination) {
                      <span class="text-muted">
                        Hiển thị {{ pagination.start }}-{{ pagination.end }}
                        trong tổng số {{ pagination.total }} cầu thủ
                      </span>
                    }
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
              }
            </div>
          </div>
          <!-- Monthly Comparison (All Time View) -->
          @if (viewMode === 'all') {
            <div class="modern-table-card mt-4">
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
                      @for (month of availableMonths; track month; let i = $index) {
                        <tr
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
                            @if (monthlyStats[month]?.topScorer) {
                              <div class="player-achievement">
                                <div class="player-avatar-wrapper">
                                  <img [src]="getPlayerAvatar(monthlyStats[month]?.topScorer?.name!)"
                                    [alt]="monthlyStats[month]?.topScorer?.name"
                                    class="monthly-avatar"
                                    (error)="onImageError($event)">
                                  <div class="achievement-badge goals-badge">{{monthlyStats[month]?.topScorer?.goals}}</div>
                                </div>
                                <div class="player-name-small">{{monthlyStats[month]?.topScorer?.name}}</div>
                              </div>
                            } @else {
                              <div class="no-data">Chưa có</div>
                            }
                          </td>
                          <td class="player-cell">
                            @if (monthlyStats[month]?.topAssist) {
                              <div class="player-achievement">
                                <div class="player-avatar-wrapper">
                                  <img [src]="getPlayerAvatar(monthlyStats[month]?.topAssist?.name!)"
                                    [alt]="monthlyStats[month]?.topAssist?.name"
                                    class="monthly-avatar"
                                    (error)="onImageError($event)">
                                  <div class="achievement-badge assists-badge">{{monthlyStats[month]?.topAssist?.assists}}</div>
                                </div>
                                <div class="player-name-small">{{monthlyStats[month]?.topAssist?.name}}</div>
                              </div>
                            } @else {
                              <div class="no-data">Chưa có</div>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
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
        }
    
        <!-- No Data Template -->
      </div>
    `,
  styleUrl: './stats.component.css'
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
