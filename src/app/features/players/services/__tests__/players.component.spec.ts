import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PlayersComponent } from '../../players.component';
import { AIAnalysisService } from '../ai-analysis.service';
import { FirebasePlayerService } from '../../../../core/services/firebase-player.service';
import { MatchService } from '../../../../core/services/match.service';
import { DataStoreService } from '../../../../core/services/data-store.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { of } from 'rxjs';

class MockAIAnalysisService { analyzeTeams(){ return { prediction:{ predictedScore:{ xanh:1, cam:2 }, winProbability:{ xanh:0.4, cam:0.6 } }, keyFactors:[], historicalContext:{ recentPerformance:{ xanhWins:0, camWins:0, draws:0 }, matchesAnalyzed:0 } }; } }
class MockFirebasePlayerService { players$=of([]); getAllPlayers(){ return []; } }
class MockMatchService { completedMatches$=of([]); createMatch(){ return Promise.resolve(); } }
class MockDataStoreService { addFundTransaction(){ return Promise.resolve(); } }
class MockLoggerService {
  log() { /* noop */ } debug() { /* noop */ } info() { /* noop */ } warn() { /* noop */ } error() { /* noop */ }
  debugDev() { /* noop */ } infoDev() { /* noop */ } warnDev() { /* noop */ } errorDev() { /* noop */ } success() { /* noop */ }
}

describe('PlayersComponent', () => {
  let component: PlayersComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports:[PlayersComponent],
      providers:[
        { provide: AIAnalysisService, useClass: MockAIAnalysisService },
        { provide: FirebasePlayerService, useClass: MockFirebasePlayerService },
        { provide: MatchService, useClass: MockMatchService },
        { provide: DataStoreService, useClass: MockDataStoreService },
        { provide: LoggerService, useClass: MockLoggerService }
      ]
    });
    const fixture = TestBed.createComponent(PlayersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should memoize pagination results until state changes', () => {
    component.allPlayers = Array.from({length:25},(_,i)=>({ id:i+1, firstName:'P'+(i+1), lastName:'', position:'', DOB:0, height:0, weight:0, avatar:'', note:'' }));
    const first = component.getPaginatedPlayers();
    const second = component.getPaginatedPlayers();
    expect(first).toBe(second);
    component.nextPage();
    const third = component.getPaginatedPlayers();
    expect(third).not.toBe(first);
  });

  it('should not auto-run AI analysis on team changes (manual trigger only)', fakeAsync(() => {
    // Access private method via type assertion
  jest.spyOn(component as unknown as { runAIAnalysis: () => void }, 'runAIAnalysis');
    component.teamA=[{ id:1, firstName:'A', lastName:'', position:'', DOB:0, height:0, weight:0, avatar:'', note:'' }];
    component.teamB=[{ id:2, firstName:'B', lastName:'', position:'', DOB:0, height:0, weight:0, avatar:'', note:'' }];
    (component as unknown as { triggerTeamChange: () => void }).triggerTeamChange();
    (component as unknown as { triggerTeamChange: () => void }).triggerTeamChange();
    (component as unknown as { triggerTeamChange: () => void }).triggerTeamChange();
    tick(600);
  expect((component as unknown as { runAIAnalysis: () => void }).runAIAnalysis).not.toHaveBeenCalled();
  }));
});
