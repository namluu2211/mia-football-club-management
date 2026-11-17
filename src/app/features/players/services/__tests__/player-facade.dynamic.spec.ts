import { TestBed } from '@angular/core/testing';
import { DynamicPlayerFacadeLoader } from '../player-facade.dynamic';

// Mock the dynamic import in the loader
jest.mock('../../../../core/services/firebase-player.service', () => {
  const { BehaviorSubject } = jest.requireActual('rxjs');
  class MockFirebasePlayerService {
    players$ = new BehaviorSubject([]);
    async createPlayer(){ /* noop */ }
    async updatePlayer(){ /* noop */ }
    async deletePlayer(){ /* noop */ }
  }
  return { FirebasePlayerService: MockFirebasePlayerService };
});

describe('DynamicPlayerFacadeLoader', () => {
  it('loads facade only once and caches instance', async () => {
    const loader = TestBed.inject(DynamicPlayerFacadeLoader);
    const first = await loader.ensureFacade();
    const second = await loader.ensureFacade();
    expect(first).toBe(second); // same cached instance
    expect(typeof first.createPlayer).toBe('function');
  });
});
