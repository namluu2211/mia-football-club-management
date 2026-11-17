import { Component, ChangeDetectionStrategy, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, Type, inject, OnDestroy, AfterViewInit } from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-players-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (error) {
      <div class="players-shell-error" role="alert">
        <h3>⚠️ Không tải được module đội hình</h3>
        <p>{{errorMessage}}</p>
        <button type="button" (click)="retry()" class="retry-btn">Thử lại</button>
      </div>
    } @else {
      @if (loaded) {
        <ng-container *ngComponentOutlet="playersComponent; inputs: componentInputs"></ng-container>
      } @else {
        <div class="players-shell-loading">
          <div class="spinner"></div>
          <div>Tải đội hình...</div>
        </div>
      }
    }
    `,
  styles:[`
    .players-shell-loading { display:flex; flex-direction:column; align-items:center; padding:24px; color:#444; }
    .spinner { width:32px; height:32px; border:4px solid #ccc; border-top-color:#2196f3; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:12px; }
    @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    .players-shell-error { border:1px solid #d32f2f; background:#ffebee; padding:20px; border-radius:12px; text-align:center; max-width:480px; margin:24px auto; color:#b71c1c; }
    .players-shell-error h3 { margin:0 0 8px; font-size:1.05rem; }
    .retry-btn { background:#1976d2; color:#fff; border:none; padding:10px 18px; border-radius:24px; cursor:pointer; font-weight:600; }
    .retry-btn:hover { background:#145fa6; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayersShellComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() canEdit = false;
  playersComponent: Type<unknown> | null = null;
  loaded = false;
  componentInputs: Record<string, unknown> = {};
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly permission = inject(PermissionService);
  private permSub?: Subscription;
  error=false; errorMessage='';

  async ngOnInit() { await this.load(); }

  ngAfterViewInit(){
    // Subscribe after initial load to minimize flashes
    this.permSub = this.permission.canEditChanges().subscribe(can => {
      this.canEdit = can;
      if(this.loaded){
        this.componentInputs = { ...this.componentInputs, canEdit: can };
        this.cdr.markForCheck();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges){
    // If canEdit input changed, propagate to loaded component inputs
    if('canEdit' in changes && this.loaded){
      this.componentInputs = { ...this.componentInputs, canEdit: this.canEdit };
    }
    // propagate updated canEdit to dynamically loaded component
    if(this.loaded){ this.cdr.markForCheck(); }
  }

  private async load(){
    this.error=false; this.errorMessage='';
    try {
      // Add small delay to allow initial route stabilization
      const module = await import(/* webpackChunkName: 'players-component' */ './players.component');
      this.playersComponent = module.PlayersComponent;
      this.componentInputs = { canEdit: this.canEdit };
      this.loaded = true;
    } catch (e:unknown) {
      console.error('Failed to dynamically import players.component', e);
      this.error=true;
      if (e && typeof e === 'object' && 'message' in e) {
        this.errorMessage = String((e as { message?: unknown }).message);
      } else {
        this.errorMessage = 'Không thể tải file JS (có thể do 404 hoặc cache cũ).';
      }
    } finally {
      this.cdr.markForCheck();
    }
  }

  retry(){ this.loaded=false; this.playersComponent=null; void this.load(); }

  ngOnDestroy(){ this.permSub?.unsubscribe(); }
}
