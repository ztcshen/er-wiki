import i18n from '@drawdb/i18n/i18n';
import { useTranslation } from 'react-i18next';
import messages from './messages.json';
import errorsZh from './errors.zh.json';

i18n.addResourceBundle('en', 'desktop', { ...messages, ...Object.fromEntries(Object.keys(errorsZh).map(k=>[k,k])) }, true, true);
i18n.addResourceBundle('zh', 'desktop', { ...Object.fromEntries(Object.keys(messages).map(k => [k, k])), ...errorsZh }, true, true);
export const tr = (message, values = {}) => {
  const key = String(message || '').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
  return i18n.t(key, { ns: 'desktop', keySeparator: false, nsSeparator: false, defaultValue: key, ...values });
};
export const useLocale = () => useTranslation('desktop');
export const dateText = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : String(value || '');
};
export async function setLanguage(language) {
  const preferences = await window.erDesktop.setPreferences({ language });
  await i18n.changeLanguage(preferences.resolvedLanguage);
  document.documentElement.lang = preferences.resolvedLanguage;
  return preferences;
}
export async function initializeLanguage(legacyLanguage) {
  let preferences = await window.erDesktop.getPreferences();
  if(!preferences.configured && /^(zh|en)(-|$)/i.test(legacyLanguage||''))
    preferences=await window.erDesktop.setPreferences({language:/^zh/i.test(legacyLanguage)?'zh':'en'});
  await i18n.changeLanguage(preferences.resolvedLanguage);
  document.documentElement.lang = preferences.resolvedLanguage;
}
