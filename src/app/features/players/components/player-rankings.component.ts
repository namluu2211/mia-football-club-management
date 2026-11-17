import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PlayerStats { name: string; goals: number; assists: number; yellowCards: number; redCards: number; matches: number; }

@Component({
  selector: 'app-player-rankings',
  standalone: true,
  imports: [CommonModule],
  template: `
  @if (topPlayers && topPlayers.length) {
    <div class="player-rankings-section">
      <div class="rankings-card">
        <div class="rankings-header">
          <h3><i class="fas fa-trophy me-2"></i>Top Cầu Thủ</h3>
          <button class="modern-btn btn-sm" (click)="toggle.emit()">{{showPlayerRankings ? 'Ẩn' : 'Hiện'}} bảng xếp hạng</button>
        </div>
        <div class="rankings-subtitle">Xếp hạng dựa trên thống kê từ lịch sử trận đấu</div>
        @if (showPlayerRankings) {
          <div class="rankings-table-wrapper">
            <table class="rankings-table">
              <thead>
                <tr>
                  <th>Hạng</th><th>Cầu thủ</th><th>G</th><th>A</th><th>Vàng</th><th>Đỏ</th><th>Trận</th><th>Điểm</th>
                </tr>
              </thead>
              <tbody>
                @for (p of topPlayers; track p; let i = $index) {
                  <tr [class]="'rank-' + (i+1)" [class.rank-1]="i===0" [class.rank-2]="i===1" [class.rank-3]="i===2">
                    <td class="rank-cell"><span class="rank-badge" [class.gold]="i===0" [class.silver]="i===1" [class.bronze]="i===2">{{i+1}}</span></td>
                    <td class="player-cell">
                      <div class="player-info-row">
                        <div class="player-avatar-small"><img [src]="getPlayerAvatarByName(p.name)" (error)="onPlayerAvatarError($event)" class="avatar-img" [alt]="p.name" /></div>
                        <span class="player-name-text">{{p.name}}</span>
                      </div>
                    </td>
                    <td class="stat-cell"><span class="stat-value goals">{{p.goals}}</span></td>
                    <td class="stat-cell"><span class="stat-value assists">{{p.assists}}</span></td>
                    <td class="stat-cell"><span class="stat-value yellow">{{p.yellowCards}}</span></td>
                    <td class="stat-cell"><span class="stat-value red">{{p.redCards}}</span></td>
                    <td class="stat-cell"><span class="stat-value matches">{{p.matches}}</span></td>
                    <td class="score-cell"><span class="score-badge" [class.high-score]="calculatePlayerScore(p) > 25" [class.medium-score]="calculatePlayerScore(p) > 15 && calculatePlayerScore(p) <= 25" [class.low-score]="calculatePlayerScore(p) <= 15">{{calculatePlayerScore(p) | number:'1.0-0'}}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerRankingsComponent {
  @Input() topPlayers: PlayerStats[] = [];
  @Input() showPlayerRankings = true;
  @Output() toggleRankings = new EventEmitter<void>();
  @Input() getPlayerAvatarByName: (name:string)=>string = ()=>'assets/images/default-avatar.svg';
  @Input() calculatePlayerScore: (p:PlayerStats)=>number = () => 0;

  onPlayerAvatarError(ev:Event){ const img=ev.target as HTMLImageElement; img.style.display='none'; }
}
