import { storage } from '@wxt-dev/storage';

// Define the global enabled state toggle
export const isEnabledStorage = storage.defineItem<boolean>('local:isEnabled', {
  defaultValue: true,
});

// Define the active filters state
export const activeFiltersStorage = storage.defineItem<string[]>('local:activeFilters', {
  defaultValue: [
    'Tiny Click Target',
    'Low Contrast',
    'Missing Alt Text',
    'Heading Hierarchy',
    'Too Many CTAs',
  ],
});
