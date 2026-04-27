/**
 *
 * PluginIcon
 *
 */

import React from 'react';
import { ChartCircle } from '@strapi/icons';

const PluginIcon = (props: React.ComponentProps<typeof ChartCircle>) => (
  <ChartCircle {...props} />
);

export default PluginIcon;
