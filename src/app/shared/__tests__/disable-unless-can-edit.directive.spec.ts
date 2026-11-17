import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DisableUnlessCanEditDirective } from '../disable-unless-can-edit.directive';
import { PermissionService } from '../../core/services/permission.service';

class MockPermissionService {
  private state = { canEdit: false, role: '', loggedIn: false };
  private listeners: ((v:boolean)=>void)[] = [];
  canEditChanges(){ return { subscribe: (fn:(v:boolean)=>void) => { this.listeners.push(fn); fn(this.state.canEdit); return { unsubscribe: () => undefined }; } }; }
  getCurrent(){ return this.state; }
  set(can: boolean){ this.state.canEdit = can; this.listeners.forEach(l=>l(can)); }
}

@Component({
  standalone: true,
  template: `
    <button id="btn" appDisableUnlessCanEdit>Test</button>
    <input id="input" appDisableUnlessCanEdit />
    <button id="override" [appDisableUnlessCanEdit]="false">Override</button>
  `,
  imports: [DisableUnlessCanEditDirective]
})
class HostComponent {}

describe('DisableUnlessCanEditDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let mock: MockPermissionService;

  beforeEach(() => {
    mock = new MockPermissionService();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: PermissionService, useValue: mock }]
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('disables elements when cannot edit', () => {
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('#btn');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#input');
  expect(btn.disabled).toBeTruthy();
  expect(input.disabled).toBeTruthy();
  });

  it('enables when permission flips to canEdit', () => {
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('#btn');
    mock.set(true);
    fixture.detectChanges();
  expect(btn.disabled).toBeFalsy();
  });

  it('override stays enabled even when cannot edit', () => {
    const override: HTMLButtonElement = fixture.nativeElement.querySelector('#override');
  expect(override.disabled).toBeFalsy();
    mock.set(true);
    fixture.detectChanges();
  expect(override.disabled).toBeFalsy();
    mock.set(false);
    fixture.detectChanges();
  expect(override.disabled).toBeFalsy();
  });
});
