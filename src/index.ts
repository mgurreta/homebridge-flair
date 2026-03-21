import type { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { FlairPlatform } from './platform';
import 'reflect-metadata';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API): void => {
  api.registerPlatform('@mgurreta/homebridge-flair', PLATFORM_NAME, FlairPlatform);
}
