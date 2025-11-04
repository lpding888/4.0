'use client';

/**
 * I18N-P2-LOCALE-209: 语言切换器组件
 * 艹！支持中英文切换，保存到 localStorage！
 *
 * @author 老王
 */

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

const languages = [
  { value: 'zh', label: '简体中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    // 保存到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }

    // 替换 URL 中的语言代码
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <Select
      value={locale}
      onChange={handleChange}
      style={{ width: 150 }}
      suffixIcon={<GlobalOutlined />}
      options={languages.map((lang) => ({
        value: lang.value,
        label: (
          <span>
            {lang.flag} {lang.label}
          </span>
        ),
      }))}
    />
  );
}
