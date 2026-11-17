import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerDataFacade } from '../players/services/player-data-facade.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-admin-settings-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="admin-settings" aria-labelledby="adminSettingsHeading">
    <h2 id="adminSettingsHeading">Admin Settings</h2>
    <div class="setting-group">
      <span class="setting-label">Data Mode:</span>
      <button (click)="toggleDataMode()" [attr.aria-live]="'polite'">{{ dataMode$ | async }}</button>
    </div>
    <div class="setting-group">
      <span class="setting-label">AI Analysis:</span>
      @if (aiEnabled$ | async; as enabled) {
        <button (click)="toggleAI()" [attr.aria-pressed]="enabled">{{ enabled ? 'Enabled' : 'Disabled' }}</button>
      }
    </div>
    <div class="setting-group">
      <span class="setting-label">Analytics Export:</span>
      <button (click)="exportAnalytics()" [disabled]="exporting">{{ exporting? 'Exporting...' : 'Export JSON' }}</button>
    </div>
    <div class="setting-group">
      <span class="setting-label">Manual Firebase Sync Flush:</span>
      <button (click)="flushFirebaseBatch()" [disabled]="flushing">{{ flushing? 'Flushing...' : 'Flush Now' }}</button>
    </div>
    @if (statusMsg) {
      <p class="status">{{ statusMsg }}</p>
    }
  </section>
  `,
  styles: [`
    .admin-settings { padding: 1rem; border: 1px solid #ccc; border-radius: 8px; max-width: 420px; background:#fafafa; }
    h2 { margin-top:0; font-size:1.2rem; }
    .setting-group { display:flex; align-items:center; gap:.75rem; margin-bottom:.75rem; }
    button { cursor:pointer; padding:.5rem .9rem; border:1px solid #666; background:#fff; border-radius:4px; }
    button:hover { background:#f0f0f0; }
    .status { font-size:.85rem; color:#336699; margin-top:.5rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSettingsPanelComponent {
  private readonly playerFacade = inject(PlayerDataFacade);
  private readonly statistics = inject(StatisticsService);
  private readonly flags = inject(FeatureFlagsService);
  dataMode$ = new BehaviorSubject<'file'|'firebase'>(this.playerFacade.useFileMode? 'file':'firebase');
  aiEnabled$ = this.flags.flag$('aiAnalysis');
  exporting = false;
  flushing = false;
  statusMsg = '';

  toggleDataMode(){
    const next = this.dataMode$.value === 'file' ? 'firebase':'file';
    this.playerFacade.setMode(next);
    this.dataMode$.next(next);
    this.setStatus(`Switched data mode to ${next}`);
  }

  toggleAI(){
    const current = this.flags.isEnabled('aiAnalysis');
    const next = !current;
    this.flags.setFlag('aiAnalysis', next);
    this.setStatus(`AI analysis ${next? 'enabled':'disabled'}`);
  }

  async exportAnalytics(){
    this.exporting = true;
    this.setStatus('Exporting analytics...');
    const sub = this.statistics.exportStatisticsReport().subscribe(json => {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.exporting = false;
      this.setStatus('Analytics exported');
      sub.unsubscribe();
    });
  }

  async flushFirebaseBatch(){
    this.flushing = true;
    this.setStatus('Flushing batch sync...');
    // Trigger an immediate sync by calling private syncBatch via exposed method pattern
    // Minimal approach: re-run individual sync functions once
    try {
      const playerStats = await this.statistics.getPlayerStatistics().pipe().toPromise();
      const teamStats = await this.statistics.getTeamStatistics().pipe().toPromise();
      const fundAnalytics = await this.statistics.getFundAnalytics().pipe().toPromise();
      if(playerStats) await this.statistics.syncPlayerStatisticsToFirebase(playerStats);
      if(teamStats) await this.statistics.syncTeamStatisticsToFirebase(teamStats);
      if(fundAnalytics) await this.statistics.syncFundAnalyticsToFirebase(fundAnalytics);
      this.setStatus('Manual flush completed');
    } catch{
      this.setStatus('Manual flush failed');
    } finally {
      this.flushing = false;
    }
  }

  private setStatus(msg: string){
    this.statusMsg = msg;
    setTimeout(()=>{ this.statusMsg = ''; }, 3500);
  }
}
