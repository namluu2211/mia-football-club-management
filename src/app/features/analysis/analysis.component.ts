import { Component, ChangeDetectionStrategy, inject } from '@angular/core';

import { DataStoreService } from '../../core/services/data-store.service';
import { Player } from '../players/player-utils';
import { FirebaseService } from '../../services/firebase.service';
import { environment } from '../../../environments/environment';
import { combineLatest } from 'rxjs';
import { AIWorkerService } from '../players/services/ai-worker.service';

interface AnalysisResult {
  predictedScore:{xanh:number;cam:number};
  xanhWinProb:number; camWinProb:number;
  keyFactors:{name:string;impact:number}[];
  historicalStats?:{xanhWins:number;camWins:number;draws:number;totalMatches:number};
  teamStrengths?:{teamA:number;teamB:number;balanceScore:number};
}

@Component({
  selector:'app-analysis',
  standalone:true,
  imports: [],
  template:`
  @if (teamA.length || teamB.length) {
    <div class="analysis-container">
      <h2 class="page-title"><i class="fas fa-brain me-2"></i>🔬 Phân Tích Đội Hình</h2>
      <p class="text-muted mb-3">Phân tách logic AI khỏi trang chia đội để giảm kích thước bundle ban đầu.</p>
      <div class="teams-preview mb-3">
        <div class="team-box xanh">
          <h5>🟦 Đội Xanh ({{teamA.length}})</h5>
          <div class="players">{{ formatNames(teamA) }}</div>
        </div>
        <div class="team-box cam">
          <h5>🟧 Đội Cam ({{teamB.length}})</h5>
          <div class="players">{{ formatNames(teamB) }}</div>
        </div>
      </div>
      <!-- Manual AI button removed -->
      @if (result) {
        <div class="result-card mt-4">
          <h4>Kết quả dự đoán: {{result.predictedScore.xanh}} - {{result.predictedScore.cam}}</h4>
          <p>Tỷ lệ thắng: 🟦 {{result.xanhWinProb}}% | 🟧 {{result.camWinProb}}%</p>
          @if (result.teamStrengths) {
            <div class="strengths mb-3">
              <strong>Sức mạnh trung bình:</strong>
              🟦 {{result.teamStrengths.teamA}} | 🟧 {{result.teamStrengths.teamB}} | Cân bằng: {{result.teamStrengths.balanceScore}}%
            </div>
          }
          @if (result.keyFactors?.length) {
            <div>
              <h5>Yếu tố chính</h5>
              <ul>
                @for (f of result.keyFactors; track f) {
                  <li>{{f.name}}: {{f.impact > 0 ? '+' : ''}}{{f.impact}}%</li>
                }
              </ul>
            </div>
          }
          @if (result.historicalStats) {
            <div>
              <h5>Lịch sử gần đây ({{result.historicalStats.totalMatches}} trận)</h5>
              <p>🟦 {{result.historicalStats.xanhWins}} thắng | 🟧 {{result.historicalStats.camWins}} thắng | 🤝 {{result.historicalStats.draws}} hòa</p>
            </div>
          }
        </div>
      }
    </div>
  } @else {
    <div class="empty-state">
      <h3>Chưa có đội hình</h3>
      <p>Quay lại trang Chia Đội để chọn và xuất sang phân tích.</p>
    </div>
  }
  `,
  styles:[`
    .analysis-container{max-width:960px;margin:0 auto;padding:1rem;}
    .teams-preview{display:flex;gap:1rem;flex-wrap:wrap;}
    .team-box{flex:1 1 45%;background:#f8f9fa;border-radius:12px;padding:1rem;border:1px solid #e2e8f0;}
    .team-box.xanh{border-left:4px solid #3498db;}
    .team-box.cam{border-left:4px solid #f39c12;}
    .players{font-size:.9rem;color:#555;margin-top:.5rem;min-height:40px;}
    .result-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;box-shadow:0 2px 6px rgba(0,0,0,.06);} 
    .empty-state{text-align:center;padding:4rem 1rem;color:#666;}
    button.btn{border-radius:24px;padding:.75rem 1.5rem;font-weight:600;}
  `],
  changeDetection:ChangeDetectionStrategy.OnPush
})
export class AnalysisComponent {
  private readonly store = inject(DataStoreService);
  private readonly firebase = inject(FirebaseService);
  teamA:Player[]=[]; teamB:Player[]=[];
  isAnalyzing=false; result:AnalysisResult|null=null;
  private lastHash='';
  private readonly aiWorker = inject(AIWorkerService);

  constructor(){
    combineLatest([this.store.teamA$, this.store.teamB$]).subscribe(([a,b])=>{
      this.teamA=a; this.teamB=b;
    });
  }

  private computeHash(a:Player[],b:Player[]):string{
    const idsA=a.map(p=>p.id).sort().join(',');
    const idsB=b.map(p=>p.id).sort().join(',');
    return `${a.length}:${idsA}|${b.length}:${idsB}`;
  }

  formatNames(arr:Player[]):string { return arr.map(p=>p.firstName).join(', '); }

  async runAnalysis(){
    if(!environment.features.aiAnalysis) return;
    if(!this.teamA.length||!this.teamB.length) return;
    const hash=this.computeHash(this.teamA,this.teamB);
    if(hash===this.lastHash && this.result) return;
    this.isAnalyzing=true;
    try {
      this.aiWorker.analyze(this.teamA,this.teamB).subscribe({
        next: raw => {
          // raw: AIWorkerResult & { mode, duration }
          this.result={
            predictedScore: raw.prediction.predictedScore,
            xanhWinProb: raw.prediction.winProbability.xanh,
            camWinProb: raw.prediction.winProbability.cam,
            keyFactors: raw.keyFactors,
            teamStrengths: raw.headToHead ? undefined : undefined // simplified view; could compute separately
          };
          this.lastHash=hash;
        },
        error: err => {
          console.error('AI worker analysis failed', err);
        },
        complete: () => {
          this.isAnalyzing=false;
        }
      });
    } catch(err){
      console.error('AI worker analysis invocation error', err);
      this.isAnalyzing=false;
    }
  }
}
