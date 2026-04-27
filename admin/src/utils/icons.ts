import type * as React from 'react';
import * as iconsModule from '@strapi/icons';

const icons = iconsModule as unknown as Record<string, React.ComponentType<any>>;

const pickIcon = (...names: string[]): React.ComponentType<any> => {
  for (const name of names) {
    if (icons[name]) return icons[name];
  }
  throw new Error(
    `[strapi-plugin-rebuilder] None of the icons [${names.join(', ')}] are exported by @strapi/icons`
  );
};

export const Refresh = pickIcon('ArrowClockwise', 'Refresh');
export const Information = pickIcon('Information', 'Info', 'QuestionMark');
