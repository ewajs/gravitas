import { computed } from 'vue';
import { useData } from 'vitepress';

/** The page's language for explorer strings and number formatting. */
export function useLocale() {
  const { lang } = useData();
  const english = computed(() => lang.value.startsWith('en'));
  const format = (value: number, digits = 1) =>
    new Intl.NumberFormat(lang.value, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  return { english, lang, format };
}
