import { TestBed } from '@angular/core/testing';
import { PermissionService } from '../permission.service';

/**
 * Unit tests for PermissionService
 */
describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PermissionService);
  });

  function expectSnapshot(canEdit: boolean, role: string, loggedIn: boolean) {
    const snap = service.getCurrent();
    expect(snap.canEdit).toBe(canEdit);
    expect(snap.role).toBe(role);
    expect(snap.loggedIn).toBe(loggedIn);
  }

  it('should start with default snapshot', () => {
    expectSnapshot(false, '', false);
  });

  it('viewer (logged in but role viewer) cannot edit', () => {
    service.setAuthState({ loggedIn: true, role: 'viewer' });
    expectSnapshot(false, 'viewer', true);
  });

  it('admin can edit', () => {
    service.setAuthState({ loggedIn: true, role: 'admin' });
    expectSnapshot(true, 'admin', true);
  });

  it('superadmin can edit', () => {
    service.setAuthState({ loggedIn: true, role: 'superadmin' });
    expectSnapshot(true, 'superadmin', true);
  });

  it('logged out resets permissions', () => {
    service.setAuthState({ loggedIn: true, role: 'admin' });
    service.setAuthState({ loggedIn: false, role: '' });
    expectSnapshot(false, '', false);
  });

  it('emits canEdit changes appropriately', (done) => {
    const states: boolean[] = [];
    const sub = service.canEditChanges().subscribe(v => { states.push(v); if (states.length === 3) { sub.unsubscribe();
      expect(states).toEqual([false, true, false]);
      done(); }
    });
    service.setAuthState({ loggedIn: true, role: 'admin' });
    service.setAuthState({ loggedIn: false, role: '' });
  });
});
