// 旧拡張用の未接続設定（index.htmlからは読み込まない）。
// 現在の共通GASアクセス記録はaccess-counter.jsで独立して実装している。
window.SPIN_OUT_CONFIG = {
  access: {
    enabled: false,
    // 共通方式に合わせた関数を設定する。失敗してもゲームには影響しない。
    // record: async ({ app, visitId }) => { /* 確認済みGASへの送信処理 */ }
    record: null
  }
};
