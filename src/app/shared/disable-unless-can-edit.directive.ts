import { Directive, ElementRef, Input, OnDestroy, Renderer2, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PermissionService } from '../core/services/permission.service';

/**
 * Attribute directive: appDisableUnlessCanEdit
 * Disables (sets disabled attribute / aria-disabled) when the user cannot edit.
 * Usage:
 *   <button appDisableUnlessCanEdit>Save</button>
 *   <input appDisableUnlessCanEdit type="text" />
 * Optional override: [appDisableUnlessCanEdit]="false" to force enable regardless.
 */
@Directive({
  selector: '[appDisableUnlessCanEdit]',
  standalone: true
})
export class DisableUnlessCanEditDirective implements OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private rnd = inject(Renderer2);
  private perm = inject(PermissionService);
  private sub: Subscription;

  // Allow boolean binding to temporarily skip disabling logic
  private manualOverride = true;
  @Input()
  set appDisableUnlessCanEdit(val: boolean | '' | undefined) {
    // If explicitly bound false, we skip disabling logic.
    if (val === false) {
      this.manualOverride = false;
      this.applyState(true);
    } else {
      this.manualOverride = true;
      this.applyState(this.perm.getCurrent().canEdit);
    }
  }

  constructor() {
    this.sub = this.perm.canEditChanges().subscribe(can => {
      if (this.manualOverride) this.applyState(can);
    });
    // initial
    this.applyState(this.perm.getCurrent().canEdit);
  }

  private applyState(canEdit: boolean) {
    const native = this.el.nativeElement as HTMLElement;
    const isFormControl = 'disabled' in native;
    if (!canEdit) {
      if (isFormControl) this.rnd.setProperty(native, 'disabled', true);
      this.rnd.setAttribute(native, 'aria-disabled', 'true');
      this.rnd.addClass(native, 'viewer-disabled');
    } else {
      if (isFormControl) this.rnd.setProperty(native, 'disabled', false);
      this.rnd.removeAttribute(native, 'aria-disabled');
      this.rnd.removeClass(native, 'viewer-disabled');
    }
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}
