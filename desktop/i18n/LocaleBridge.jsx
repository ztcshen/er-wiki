import { LocaleProvider } from '@douyinfe/semi-ui';
import en from '@douyinfe/semi-ui/lib/es/locale/source/en_US';
import zh from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import { useLocale } from './renderer';

export default function LocaleBridge({ children }) {
  const { i18n } = useLocale();
  return <LocaleProvider locale={i18n.language.startsWith('zh') ? zh : en}>{children}</LocaleProvider>;
}
