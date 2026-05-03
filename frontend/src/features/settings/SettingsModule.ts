import type { FeatureModule } from '../../core/featureRegistry/FeatureModule';
import { Routes } from '../../core/navigation/routes';
import { SettingsScreen } from './SettingsScreen';

export const settingsModule: FeatureModule = {
  id: 'settings',
  routes: [{ name: Routes.Settings, component: SettingsScreen, options: { headerShown: false } }],
};
