import type { FeatureModule } from '../../core/featureRegistry/FeatureModule';
import { Routes } from '../../core/navigation/routes';
import { ProfileScreen } from './ProfileScreen';

export const profileModule: FeatureModule = {
  id: 'profile',
  routes: [{ name: Routes.Profile, component: ProfileScreen, options: { headerShown: false } }],
};
