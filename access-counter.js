// 共通GAS：rush-hour-puzzle / pencil-factory / chopsticks-gameと同じURL・GET方式。
// ページを開くたびに1回。ゲーム操作・再挑戦では呼ばず、応答待ち・再送もしない。
// no-corsでは累計値も記録成功も確認できないため、数値や成功表示は作らない。
(() => {
  if (window.spinOutAccessRecorded) return;
  window.spinOutAccessRecorded = true;
  try {
    fetch('https://script.google.com/macros/s/AKfycbxssCIHsD-N97SHxNC_GN0ihYeC0qy-lb-EY0KmSs6Gnztaph1sITMerLVEnNWOGkYc/exec?app=spin-out-puzzle', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {});
  } catch {
    // オフライン・fetch未対応・同期例外でもパズルに影響させない。
  }
})();
