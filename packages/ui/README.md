# @gravitas/ui

The UI workspace currently provides only the initial viewport's localized text.
Lit components and a visible locale selector arrive in step 0.4.

```ts
import { setLocale, viewportMessages } from '@gravitas/ui';

await setLocale('en'); // 'es-AR' is the source/default locale.
const text = viewportMessages();
statusElement.textContent = text.loading;
```

This uses `@lit/localize` runtime mode. Source strings use Rioplatense Spanish with
explicit message IDs; `src/locales/en.ts` contains their English translations.
Await `setLocale()` before reading messages. For now translations are small and
maintained together; extraction/generation and component update wiring belong to
the full UI step. Do not add a parallel translation framework in the application.
