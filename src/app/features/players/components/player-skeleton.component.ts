import { Component, ChangeDetectionStrategy, Input } from '@angular/core';


@Component({
  selector: 'app-player-skeleton',
  standalone: true,
  imports: [],
  template: `
    <div class="skeleton-grid" [style.--cols]="cols">
      @for (i of skeletonItems; track i) {
        <div class="skeleton-card">
          <div class="skeleton-avatar shimmer"></div>
          <div class="skeleton-line shimmer" style="width:70%"></div>
          <div class="skeleton-line shimmer" style="width:50%"></div>
        </div>
      }
    </div>
    `,
  styles: [`
    :host { display:block; }
    .skeleton-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; }
    .skeleton-card { background:#252d3c; border:1px solid #2f3a4d; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; }
    .skeleton-avatar { width:100%; aspect-ratio:3/4; border-radius:8px; background:linear-gradient(135deg,#2b3442,#202834); }
    .skeleton-line { height:10px; border-radius:6px; background:#2b3442; }
    .shimmer { position:relative; overflow:hidden; }
    .shimmer::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent); animation:shimmer 1.2s infinite; }
    @keyframes shimmer { 0% { transform:translateX(-100%); } 100% { transform:translateX(100%); } }
    @media (max-width:900px){ .skeleton-grid { grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerSkeletonComponent {
  @Input() count = 12;
  @Input() cols = 5;
  get skeletonItems(){ return Array.from({length:this.count}); }
}
