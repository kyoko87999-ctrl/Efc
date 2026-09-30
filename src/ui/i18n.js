// Minimal language switch: tr('English', 'ไทย')
let lang = 'en';
try { const l = (navigator.language || '').toLowerCase(); if (l.startsWith('th')) lang = 'th'; } catch (e) { /* ignore */ }
export const getLang = () => lang;
export const setLang = (l) => { lang = l === 'th' ? 'th' : 'en'; document.documentElement.lang = lang; };
export const tr = (en, th) => (lang === 'th' && th ? th : en);
// pick a localized field from data objects: pick(ch, 'name') -> nameTH when Thai
export const pick = (o, key) => (lang === 'th' && o[key + 'TH'] ? o[key + 'TH'] : o[key]);
