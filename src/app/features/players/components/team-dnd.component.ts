import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';

import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { Player } from '../player-utils';

@Component({
  selector: 'app-team-dnd',
  standalone: true,
  imports: [DragDropModule],
  template: `
  <div class="team-dnd-wrapper">
    @if (teamA && teamB) {
      <div class="teams">
        <div class="team-column">
          <h3>Đội Xanh ({{teamA.length}})</h3>
          <div cdkDropList [cdkDropListData]="teamA" class="player-drop-zone" (cdkDropListDropped)="onDrop($event)">
            @for (p of teamA; track p) {
              <div class="player-item" cdkDrag>
                <span>{{p.firstName}} {{p.lastName}}</span>
                <button type="button" class="remove-btn" (click)="removePlayer.emit({player:p, team:'A'})">×</button>
              </div>
            }
          </div>
        </div>
        <div class="team-column">
          <h3>Đội Cam ({{teamB.length}})</h3>
          <div cdkDropList [cdkDropListData]="teamB" class="player-drop-zone" (cdkDropListDropped)="onDrop($event)">
            @for (p of teamB; track p) {
              <div class="player-item" cdkDrag>
                <span>{{p.firstName}} {{p.lastName}}</span>
                <button type="button" class="remove-btn" (click)="removePlayer.emit({player:p, team:'B'})">×</button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  </div>
  `,
  styles: [`
    .team-dnd-wrapper { margin-top: 12px; }
    .teams { display:flex; gap:20px; }
    .team-column { flex:1; background:#fafafa; border:1px solid #e0e0e0; border-radius:8px; padding:12px; }
    .player-drop-zone { min-height:120px; border:2px dashed #ccc; padding:8px; border-radius:6px; background:#fff; }
    .player-item { display:flex; justify-content:space-between; align-items:center; padding:4px 6px; margin:4px 0; background:#f0f4ff; border-radius:4px; font-size:13px; }
    .player-item:hover { background:#e3ecff; }
    .remove-btn { background:transparent; border:none; cursor:pointer; color:#c00; font-weight:bold; }
    .remove-btn:hover { color:#900; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamDndComponent {
  @Input() teamA: Player[] = [];
  @Input() teamB: Player[] = [];
  @Output() teamDrop = new EventEmitter<CdkDragDrop<Player[]>>();
  @Output() removePlayer = new EventEmitter<{player: Player; team: 'A' | 'B'}>();

  onDrop(event: CdkDragDrop<Player[]>) {
    if (event.previousContainer === event.container) {
      const arr = event.container.data;
      const tmp = arr[event.previousIndex];
      arr[event.previousIndex] = arr[event.currentIndex];
      arr[event.currentIndex] = tmp;
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    this.teamDrop.emit(event);
  }
}
