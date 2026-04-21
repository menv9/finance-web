function toTime(value) {
  return value ? new Date(value).getTime() : 0;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function isChangedAfter(value, since) {
  if (!since) return false;
  return toTime(value) > toTime(since);
}

export function recordsDiffer(localRecord, remotePayload) {
  return stableSerialize(localRecord) !== stableSerialize(remotePayload);
}

export function detectConflict({ localRecord, localTombstone, remoteChange, lastPulledAt }) {
  const remoteChangedAfterSync = isChangedAfter(remoteChange.updated_at, lastPulledAt);
  if (!remoteChangedAfterSync) return false;

  const localChangedAfterSync = localRecord?.updatedAt
    ? isChangedAfter(localRecord.updatedAt, lastPulledAt)
    : localTombstone?.updatedAt
      ? isChangedAfter(localTombstone.updatedAt, lastPulledAt)
      : false;

  if (!localChangedAfterSync) return false;

  if (remoteChange.deleted_at) {
    return Boolean(localRecord);
  }

  if (localTombstone && remoteChange.payload) {
    return true;
  }

  return localRecord ? recordsDiffer(localRecord, remoteChange.payload) : false;
}

export function buildConflict({ storeName, remoteChange, localRecord, localTombstone }) {
  return {
    id: `${storeName}:${remoteChange.record_id}`,
    storeName,
    recordId: remoteChange.record_id,
    localRecord: localRecord || null,
    localTombstone: localTombstone || null,
    remoteRecord: remoteChange.payload || null,
    remoteDeletedAt: remoteChange.deleted_at || null,
    remoteUpdatedAt: remoteChange.updated_at,
    detectedAt: new Date().toISOString(),
  };
}

export function upsertConflict(conflicts, conflict) {
  const index = conflicts.findIndex((item) => item.id === conflict.id);
  return index >= 0
    ? conflicts.map((item) => (item.id === conflict.id ? conflict : item))
    : [conflict, ...conflicts];
}

export function removeConflict(conflicts, conflictId) {
  return conflicts.filter((item) => item.id !== conflictId);
}
