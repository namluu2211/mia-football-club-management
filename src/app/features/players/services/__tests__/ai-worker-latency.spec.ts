import { TestBed } from '@angular/core/testing';
import { AIWorkerService } from '../ai-worker.service';
// Worker will be mocked for deterministic timing.

// Mock Worker for deterministic timing
interface TestPlayer { id:number; firstName:string }
class InstantWorker {
  private listeners: ((ev: MessageEvent)=>void)[] = [];
  postMessage(data: { type:string; teamA:TestPlayer[]; teamB:TestPlayer[] }){
    if(data && data.type==='ANALYZE_TEAMS'){
      const start = performance.now();
      const duration = performance.now() - start;
      const result = {
        prediction:{ predictedScore:{ xanh:1, cam:2 }, winProbability:{ xanh:55, cam:45 } },
        keyFactors:[{ name:'BalanceDiff', impact:1 }],
        historicalContext:{ recentPerformance:{ xanhWins:0, camWins:0, draws:0 }, matchesAnalyzed:0 }
      };
      const evt = new MessageEvent('message', { data:{ type:'ANALYSIS_RESULT', result, key:'k', duration } });
      this.listeners.forEach(l=>l(evt));
    }
  }
  addEventListener(_type:string, listener:(ev:MessageEvent)=>void){ this.listeners.push(listener); }
  removeEventListener(_type:string, listener:(ev:MessageEvent)=>void){ this.listeners = this.listeners.filter(l=>l!==listener); }
}
(globalThis as unknown as { Worker: typeof Worker }).Worker = InstantWorker as unknown as typeof Worker;

describe('AIWorkerService latency', () => {
  let service: AIWorkerService;
  beforeEach(() => {
    service = TestBed.runInInjectionContext(() => new AIWorkerService());
  });

  it('records perf marks for worker path', (done) => {
    const teamA = Array.from({ length: 20 }, (_,i)=> ({ id: i+1, firstName:'A'+i }));
    const teamB = Array.from({ length: 20 }, (_,i)=> ({ id: i+101, firstName:'B'+i }));
  service.analyze(teamA, teamB).subscribe(res => {
      expect(res.mode).toBe('worker');
      expect(typeof res.duration).toBe('number');
      done();
    });
  });
});
