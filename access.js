export async function recordVisit(config, storage) {
  if (!config?.enabled || typeof config.record !== 'function') return;
  const key = 'spin-out:visit-recorded';
  try {
    storage ??= globalThis.sessionStorage;
    if (storage.getItem(key)) return;
    const visitId = globalThis.crypto?.randomUUID?.() || String(Date.now());
    storage.setItem(key, visitId); // 同じタブの再読込でも再送しない。失敗時も重複防止。
    await config.record({ app: 'spin-out-puzzle', visitId });
  } catch { /* ストレージ・通信の失敗はゲームから隔離 */ }
}
