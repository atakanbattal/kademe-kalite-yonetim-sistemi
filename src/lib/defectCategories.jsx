import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_GROUPS, getGroupMetaForCategory, getGroupLabelByKey, ALL_CATEGORY_VALUES } from '@/lib/defectCategoriesCore';

export { CATEGORY_GROUPS, getGroupMetaForCategory, getGroupLabelByKey, ALL_CATEGORY_VALUES };

export const buildCategoryOptionLabel = (category, group) => (
  <div className="flex items-center justify-between gap-2 w-full">
    <span className="truncate">{category}</span>
    <Badge variant="secondary" className={`shrink-0 text-[10px] font-medium ${group.badgeClassName}`}>
      {group.label}
    </Badge>
  </div>
);

export const normalizeContextValue = (value) => (value || '').toLocaleLowerCase('tr-TR');

export const getMatchedCategoryGroups = (department, detectionArea) => {
  const contextValue = `${normalizeContextValue(department)} ${normalizeContextValue(detectionArea)}`;

  return CATEGORY_GROUPS.filter(
    (group) =>
      group.keywords.length > 0 && group.keywords.some((keyword) => contextValue.includes(keyword))
  );
};

export const buildCategoryOptions = ({ matchedGroups = [], existingValue = '' } = {}) => {
  const prioritizedKeys = new Set(matchedGroups.map((group) => group.key));
  const orderedGroups = [
    ...matchedGroups,
    ...CATEGORY_GROUPS.filter((group) => !prioritizedKeys.has(group.key)),
  ];

  const optionsMap = new Map();
  orderedGroups.forEach((group) => {
    group.categories.forEach((category) => {
      if (!optionsMap.has(category)) {
        optionsMap.set(category, {
          value: category,
          label: buildCategoryOptionLabel(category, group),
        });
      }
    });
  });

  if (existingValue && !optionsMap.has(existingValue)) {
    optionsMap.set(existingValue, {
      value: existingValue,
      label: (
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="truncate">{existingValue}</span>
          <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
            Mevcut
          </Badge>
        </div>
      ),
    });
  }

  return Array.from(optionsMap.values());
};
