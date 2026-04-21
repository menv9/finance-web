import { describe, expect, it } from 'vitest';
import { buildConflict, detectConflict, recordsDiffer, removeConflict, upsertConflict } from './sync';

describe('sync conflict detection', () => {
  it('detects conflict when both local and remote changed after last pull', () => {
    const result = detectConflict({
      lastPulledAt: '2026-04-20T10:00:00.000Z',
      localRecord: {
        id: 'exp-1',
        description: 'Local edit',
        updatedAt: '2026-04-20T11:00:00.000Z',
      },
      localTombstone: null,
      remoteChange: {
        record_id: 'exp-1',
        updated_at: '2026-04-20T11:30:00.000Z',
        deleted_at: null,
        payload: {
          id: 'exp-1',
          description: 'Remote edit',
          updatedAt: '2026-04-20T11:30:00.000Z',
        },
      },
    });

    expect(result).toBe(true);
  });

  it('does not flag conflict when local record has not changed since last pull', () => {
    const result = detectConflict({
      lastPulledAt: '2026-04-20T10:00:00.000Z',
      localRecord: {
        id: 'exp-1',
        description: 'Existing local',
        updatedAt: '2026-04-20T09:30:00.000Z',
      },
      localTombstone: null,
      remoteChange: {
        record_id: 'exp-1',
        updated_at: '2026-04-20T11:30:00.000Z',
        deleted_at: null,
        payload: {
          id: 'exp-1',
          description: 'Remote edit',
          updatedAt: '2026-04-20T11:30:00.000Z',
        },
      },
    });

    expect(result).toBe(false);
  });

  it('treats local deletion vs remote update as conflict', () => {
    const result = detectConflict({
      lastPulledAt: '2026-04-20T10:00:00.000Z',
      localRecord: null,
      localTombstone: {
        id: 'hold-1',
        updatedAt: '2026-04-20T11:00:00.000Z',
        deletedAt: '2026-04-20T11:00:00.000Z',
      },
      remoteChange: {
        record_id: 'hold-1',
        updated_at: '2026-04-20T11:30:00.000Z',
        deleted_at: null,
        payload: {
          id: 'hold-1',
          ticker: 'VWCE.DE',
          updatedAt: '2026-04-20T11:30:00.000Z',
        },
      },
    });

    expect(result).toBe(true);
  });
});

describe('sync conflict helpers', () => {
  it('compares records with stable ordering', () => {
    expect(recordsDiffer({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
    expect(recordsDiffer({ a: 1 }, { a: 2 })).toBe(true);
  });

  it('upserts and removes conflicts predictably', () => {
    const conflict = buildConflict({
      storeName: 'expenses',
      remoteChange: {
        record_id: 'exp-1',
        updated_at: '2026-04-20T11:30:00.000Z',
        deleted_at: null,
        payload: { id: 'exp-1', amountCents: 1000 },
      },
      localRecord: { id: 'exp-1', amountCents: 900, updatedAt: '2026-04-20T11:00:00.000Z' },
      localTombstone: null,
    });

    const added = upsertConflict([], conflict);
    expect(added).toHaveLength(1);
    const removed = removeConflict(added, conflict.id);
    expect(removed).toHaveLength(0);
  });
});
