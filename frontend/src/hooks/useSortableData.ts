import { useState, useMemo } from 'react';

export type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
} | null;

export const useSortableData = <T,>(items: T[], config: SortConfig = null) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>(config);

  const sortedItems = useMemo(() => {
    const sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Handle nested properties (e.g. 'provider.name')
        const getNestedValue = (obj: T, path: string): unknown => {
          return path.split('.').reduce<unknown>((acc, part) => {
            if (acc && typeof acc === 'object' && part in acc) {
              return (acc as Record<string, unknown>)[part];
            }
            return undefined;
          }, obj);
        };

        const aValue = getNestedValue(a, sortConfig.key) ?? '';
        const bValue = getNestedValue(b, sortConfig.key) ?? '';

        if (String(aValue) < String(bValue)) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (String(aValue) > String(bValue)) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};
