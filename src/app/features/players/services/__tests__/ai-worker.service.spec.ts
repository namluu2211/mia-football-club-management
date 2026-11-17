import { TestBed } from '@angular/core/testing';
import { AIWorkerService } from '../ai-worker.service';

interface MockTeamPlayer { id: number; firstName: string }
interface MockAnalysisResult {
  prediction:{ predictedScore:{ xanh:number; cam:number }; winProbability:{ xanh:number; cam:number } };
  keyFactors:{ name:string; impact:number }[];
  historicalContext:{ recentPerformance:{ xanhWins:number; camWins:number; draws:number }; matchesAnalyzed:number };
}

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  private listeners: Record<string, ((ev: Event)=>void)[]> = {};
  constructor(public readonly scriptURL: string) {}
  postMessage(data: { type:string; teamA: MockTeamPlayer[]; teamB: MockTeamPlayer[] }): void {
    if (data.type === 'ANALYZE_TEAMS') {
      const { teamA, teamB } = data;
      const strength = (team: MockTeamPlayer[]) => team.reduce((s, p) => s + (p.id % 10 + 10), 0) / (team.length || 1);
      const aStr = strength(teamA); const bStr = strength(teamB); const total = aStr + bStr || 1;
      const xanhProb = aStr / total; const camProb = bStr / total;
      const predictedScoreA = Math.max(0, Math.round(aStr / 12));
      const predictedScoreB = Math.max(0, Math.round(bStr / 12));
      const result: MockAnalysisResult = {
        prediction:{ predictedScore:{ xanh:predictedScoreA, cam:predictedScoreB }, winProbability:{ xanh:+(xanhProb*100).toFixed(2), cam:+(camProb*100).toFixed(2) } },
        keyFactors:[ { name:'BalanceDiff', impact:Math.abs(aStr-bStr) }, { name:'AvgStrengthA', impact:aStr }, { name:'AvgStrengthB', impact:bStr } ],
        historicalContext:{ recentPerformance:{ xanhWins:0, camWins:0, draws:0 }, matchesAnalyzed:0 }
      };
      this.dispatchEvent(new MessageEvent('message', { data:{ type:'ANALYSIS_RESULT', result } }));
    }
  }
  addEventListener(type: string, listener: (ev: Event) => void): void {
    (this.listeners[type] ||= []).push(listener);
  }
  removeEventListener(type: string, listener: (ev: Event) => void): void {
    const arr=this.listeners[type]; if(!arr) return; this.listeners[type]=arr.filter(l=>l!==listener);
  }
  dispatchEvent(ev: Event): boolean { const arr=this.listeners[ev.type]; if(arr) arr.forEach(l=>l(ev)); if(ev.type==='message'&& this.onmessage) this.onmessage(ev as MessageEvent); return true; }
  terminate(): void { /* noop */ }
}

(global as unknown as { Worker: typeof Worker }).Worker = MockWorker as unknown as typeof Worker;

describe('AIWorkerService', () => {
  let service: AIWorkerService;
  beforeEach(() => {
    service = TestBed.runInInjectionContext(() => new AIWorkerService());
  });

  it('should return analysis result observable', (done) => {
    const teamA = [ { id: 11, firstName: 'A' }, { id: 22, firstName: 'B' } ];
    const teamB = [ { id: 33, firstName: 'C' } ];
    service.analyze(teamA, teamB).subscribe(res => {
      expect(res).toBeDefined();
      expect(res.prediction.predictedScore.xanh).toBeGreaterThanOrEqual(0);
      expect(res.keyFactors.length).toBeGreaterThan(0);
      done();
    });
  });

  it('should handle empty teams', (done) => {
    service.analyze([], []).subscribe(res => {
      expect(res.prediction).toBeDefined();
      expect(res.keyFactors.length).toBeGreaterThan(0);
      done();
    });
  });
});
