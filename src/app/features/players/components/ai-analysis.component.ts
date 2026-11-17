import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from '../player-utils';

export interface SimpleAIResult {
  predictedScore: { xanh: number; cam: number };
  xanhWinProb: number;
  camWinProb: number;
  keyFactors: { name: string; impact: number }[];
  historicalStats?: { xanhWins: number; camWins: number; draws: number; totalMatches: number };
  /**
   * Optional extended strengths data (0-100 scale or raw) for richer UI.
   * balance: 0 means completely uneven, 100 means perfectly balanced
   */
  teamStrengths?: { xanh: number; cam: number; balance: number };
  /** Top scoreline probabilities from joint distribution (already normalized & truncated) */
  scoreDistribution?: { scoreline: string; probability: number }[];
}

@Component({
  selector: 'app-ai-analysis',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="ai-analysis-card" *ngIf="teamA.length || teamB.length" [class.light-theme]="!darkMode">
    <div class="ai-header">
      <h4><i class="fas fa-brain me-2"></i>🤖 Phân Tích Dự Đoán AI</h4>
      <p class="ai-subtitle">Dự đoán tỷ lệ thắng dựa trên đội hình hiện tại</p>
      <button type="button" class="theme-toggle-btn" (click)="toggleTheme()" [attr.aria-label]="darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'">
        <span *ngIf="darkMode">🌞</span>
        <span *ngIf="!darkMode">🌙</span>
      </button>
    </div>
    <div class="ai-body">
      <div class="team-formation-preview mb-4">
        <h5 class="preview-title"><i class="fas fa-eye me-2"></i>Đội hình sẽ được phân tích</h5>
        <div class="formation-display">
          <div class="formation-team formation-xanh">
            <div class="formation-header">🔵 Đội Xanh ({{teamA.length}})</div>
            <div class="formation-players">
              <span *ngFor="let player of teamA; let last = last" class="formation-player">{{player.firstName}}{{!last ? ', ' : ''}}</span>
            </div>
          </div>
          <div class="formation-team formation-cam">
            <div class="formation-header">🟠 Đội Cam ({{teamB.length}})</div>
            <div class="formation-players">
              <span *ngFor="let player of teamB; let last = last" class="formation-player">{{player.firstName}}{{!last ? ', ' : ''}}</span>
            </div>
          </div>
        </div>
      </div>
  <!-- Manual trigger removed per request; analysis can auto-run externally -->
      <div class="analysis-results-enhanced" *ngIf="ai as result">
        <div class="results-header-enhanced">
          <div class="ai-badge" aria-label="Kết quả dự đoán">Kết quả</div>
          <h3 class="results-title" aria-live="polite">Dự đoán tỷ số: <span class="score-pill xanh-pill">{{result.predictedScore?.xanh ?? 0}}</span> - <span class="score-pill cam-pill">{{result.predictedScore?.cam ?? 0}}</span></h3>
          <p class="results-subtitle">Tỷ lệ thắng: 🔵 {{ (result.xanhWinProb || 0) | number:'1.0-2'}}% <span class="divider">|</span> 🟠 {{ (result.camWinProb || 0) | number:'1.0-2'}}%</p>
        </div>
        <div class="distribution-chip-row" *ngIf="result.scoreDistribution?.length">
          <div class="dist-label" [attr.title]="'Ba tỷ số có xác suất cao nhất trong Top8 phân phối. Bao phủ ' + (displayedMass*100 | number:'1.0-1') + '% tổng xác suất top8.'">
            TOP TỶ SỐ (Bao phủ {{ (displayedMass*100) | number:'1.0-1'}}% / Top8)
          </div>
          <button type="button" class="dist-toggle" (click)="toggleRelative()" [attr.aria-pressed]="showRelative" [attr.title]="showRelative ? 'Hiển thị xác suất tuyệt đối' : 'Hiển thị xác suất tương đối trong nhóm hiển thị'">
            {{ showRelative ? 'Tương đối' : 'Tuyệt đối' }}
          </button>
          <div class="dist-chips">
            <span *ngFor="let d of displayedDistribution" class="dist-chip" [attr.title]="'Tỷ số ' + d.scoreline + ' — Global: ' + (d.probability*100 | number:'1.0-2') + '% / Nhóm: ' + ((d.probability/displayedMass*100) | number:'1.0-2') + '%'">
              <span class="dist-score">{{d.scoreline}}</span>
              <span class="dist-prob" [class.relative]="showRelative">{{ formatProb(d.probability) }}</span>
              <small class="dist-prob-secondary" *ngIf="showRelative">({{ (d.probability*100) | number:'1.0-1'}}%)</small>
            </span>
          </div>
        </div>
        <div class="predictions-grid">
          <div class="prediction-card-enhanced">
            <div class="card-header">
              <div class="card-icon score-icon">⚽</div>
              <div class="card-title"><h4>Tỷ Số Dự Đoán</h4><div class="card-subtitle">Score Prediction</div></div>
            </div>
            <div class="score-display-enhanced">
              <div class="team-score-enhanced">
                <div class="team-indicator"><span class="team-dot xanh-dot"></span><span class="team-name">Đội Xanh</span></div>
                <div class="score-number-large">{{result.predictedScore?.xanh ?? 0}}</div>
              </div>
              <div class="vs-separator-enhanced"><div class="vs-text">VS</div></div>
              <div class="team-score-enhanced">
                <div class="team-indicator"><span class="team-dot cam-dot"></span><span class="team-name">Đội Cam</span></div>
                <div class="score-number-large">{{result.predictedScore?.cam ?? 0}}</div>
              </div>
            </div>
          </div>
          <div class="prediction-card-enhanced">
            <div class="card-header">
              <div class="card-icon probability-icon">📊</div>
              <div class="card-title"><h4>Xác Suất Thắng</h4><div class="card-subtitle">Win Probability</div></div>
            </div>
            <div class="probability-display-enhanced">
              <div class="prob-item-enhanced">
                <div class="prob-team-info"><span>Đội Xanh</span><span class="prob-percentage">{{ (result.xanhWinProb || 0) | number:'1.0-2'}}%</span></div>
                <div class="progress-enhanced" aria-label="Xác suất thắng đội Xanh"><div class="progress-bar-enhanced xanh-bar" [style.width.%]="result.xanhWinProb || 0"></div></div>
              </div>
              <div class="prob-item-enhanced">
                <div class="prob-team-info"><span>Đội Cam</span><span class="prob-percentage">{{ (result.camWinProb || 0) | number:'1.0-2'}}%</span></div>
                <div class="progress-enhanced" aria-label="Xác suất thắng đội Cam"><div class="progress-bar-enhanced cam-bar" [style.width.%]="result.camWinProb || 0"></div></div>
              </div>
            </div>
          </div>
          <div class="prediction-card-enhanced balance-card" *ngIf="result.teamStrengths as s">
            <div class="card-header">
              <div class="card-icon balance-icon">⚖️</div>
              <div class="card-title"><h4>Cân Bằng Đội</h4><div class="card-subtitle">Team Balance</div></div>
            </div>
            <div class="balance-meter" aria-label="Chỉ số cân bằng đội">
              <div class="balance-bars">
                <div class="balance-side xanh-side">
                  <div class="balance-label">Xanh</div>
                  <div class="balance-bar-wrapper">
                    <div class="balance-bar xanh-bar" [style.width.%]="normalizedStrength(s.xanh, s.cam).xanh"></div>
                  </div>
                  <div class="balance-value">{{s.xanh}}</div>
                </div>
                <div class="balance-center">
                  <div class="balance-score" [class.good-balance]="(s.balance||0) >= 55" [class.poor-balance]="(s.balance||0) < 40">{{s.balance || 0}}%</div>
                  <div class="balance-score-label">cân bằng</div>
                </div>
                <div class="balance-side cam-side">
                  <div class="balance-label">Cam</div>
                  <div class="balance-bar-wrapper">
                    <div class="balance-bar cam-bar" [style.width.%]="normalizedStrength(s.xanh, s.cam).cam"></div>
                  </div>
                  <div class="balance-value">{{s.cam}}</div>
                </div>
              </div>
              <div class="balance-hint" *ngIf="(s.balance||0) < 50">Gợi ý: Cân nhắc hoán đổi 1-2 cầu thủ để cân bằng hơn</div>
              <div class="balance-hint good" *ngIf="(s.balance||0) >= 50">Đội hình khá cân bằng 👍</div>
            </div>
          </div>
          <div class="prediction-card-enhanced" *ngIf="result.keyFactors?.length">
            <div class="card-header">
              <div class="card-icon factors-icon">🧠</div>
              <div class="card-title"><h4>Yếu Tố Chính</h4><div class="card-subtitle">Key Factors</div></div>
            </div>
            <div class="factors-list-enhanced">
              <div *ngFor="let factor of result.keyFactors; trackBy: trackByFactorName" class="factor-item-enhanced" [class.factor-positive]="(factor.impact||0) > 0" [class.factor-negative]="(factor.impact||0) < 0">
                <div class="factor-content">
                  <div class="factor-name-enhanced">{{factor.name}}</div>
                  <div class="factor-impact-enhanced">
                    <span class="impact-badge" [class.positive-impact]="(factor.impact||0) > 0" [class.negative-impact]="(factor.impact||0) < 0">
                      <i [class]="(factor.impact||0) > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
                      {{(factor.impact||0) > 0 ? '+' : ''}}{{factor.impact || 0}}%
                    </span>
                  </div>
                </div>
                <div class="factor-progress">
                  <div class="factor-bar" [style.width.%]="abs(factor.impact) * 2" [class.positive-bar]="(factor.impact||0) > 0" [class.negative-bar]="(factor.impact||0) < 0"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './ai-analysis.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AIAnalysisComponent {
  @Input() teamA: Player[] = [];
  @Input() teamB: Player[] = [];
  @Input() ai: SimpleAIResult | null = null;
  @Input() isAnalyzing = false;
  @Output() runAnalysis = new EventEmitter<void>();
  /* Manual trigger only now; auto-run removed */
  trackByFactorName = (_:number, f:{name:string}) => f.name;
  abs(v:number|undefined|null){ return Math.abs(v||0); }
  darkMode = true;
  showRelative = false;

  get displayedDistribution(){
    return this.ai?.scoreDistribution?.slice(0,3) || [];
  }
  get displayedMass(){
    return this.displayedDistribution.reduce((s,d)=> s + d.probability,0);
  }
  toggleRelative(){ this.showRelative = !this.showRelative; }
  formatProb(p:number){
    if(!this.showRelative) return (p*100).toLocaleString(undefined,{minimumFractionDigits:1, maximumFractionDigits:1}) + '%';
    const rel = this.displayedMass? (p/this.displayedMass)*100 : 0;
    return rel.toLocaleString(undefined,{minimumFractionDigits:1, maximumFractionDigits:1}) + '%';
  }

  toggleTheme(){
    this.darkMode = !this.darkMode;
  }

  /**
   * Normalize two raw strength values so their widths sum to 100 (or near) for bar display.
   */
  normalizedStrength(a:number, b:number){
    const safeA = a || 0; const safeB = b || 0; const total = safeA + safeB || 1;
    const xanh = +(safeA / total * 100).toFixed(2);
    const cam = +(safeB / total * 100).toFixed(2);
    return { xanh, cam };
  }
}
