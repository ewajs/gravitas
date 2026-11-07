import { computed } from 'vue';
import { useData } from 'vitepress';

// Plots format every tick, tooltip row, and table cell on each update, and building
// an Intl.NumberFormat is costly: keep one per language and digit count.
const formats = new Map<string, Intl.NumberFormat>();

/** The page's language for explorer strings and number formatting. */
export function useLocale() {
  const { lang } = useData();
  const english = computed(() => lang.value.startsWith('en'));
  const format = (value: number, digits = 1) => {
    const key = `${lang.value} ${digits}`;
    let formatter = formats.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(lang.value, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
      formats.set(key, formatter);
    }
    return formatter.format(value);
  };
  return { english, lang, format };
}
