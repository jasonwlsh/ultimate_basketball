/**
 * HTML 特殊字元轉義，防止 XSS
 * @param {string} t - 要轉義的文字
 * @returns {string} - 轉義後的文字
 */
export function escapeHtml(t){return t?t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";}
