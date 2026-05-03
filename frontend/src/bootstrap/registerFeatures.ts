import { featureRegistry } from "../core/featureRegistry/FeatureRegistry";

import { authModule } from "../features/auth/AuthModule";
import { dashboardModule } from "../features/dashboard/DashboardModule";
import { irrigationModule } from "../features/irrigation/IrrigationModule";
import { satelliteModule } from "../features/satellite/SatelliteModule";
import { diseaseDetectionModule } from "../features/diseaseDetection/DiseaseDetectionModule";
import { livestockModule } from "../features/livestock/LivestockModule";
import { communityModule } from "../features/community/CommunityModule";
import { alertsModule } from "../features/alerts/AlertsModule";
// Keep ledger optional (can be hidden from dashboard)
import { farmTrustLedgerModule } from "../features/farmTrustLedger/FarmTrustLedgerModule";
import { marketPricesModule } from "../features/marketPrices";
import { producePricesModule } from "../features/producePrices";
import { settingsModule } from "../features/settings/SettingsModule";
import { profileModule } from "../features/profile/ProfileModule";

let registered = false;

export function registerFeatures() {
  if (registered) return;
  registered = true;

  featureRegistry.register(authModule);
  featureRegistry.register(dashboardModule);
  featureRegistry.register(irrigationModule);
  featureRegistry.register(satelliteModule);
  featureRegistry.register(diseaseDetectionModule);
  featureRegistry.register(livestockModule);
  featureRegistry.register(communityModule);
  featureRegistry.register(alertsModule);
  featureRegistry.register(farmTrustLedgerModule);
  featureRegistry.register(marketPricesModule);
  featureRegistry.register(producePricesModule);
  featureRegistry.register(settingsModule);
  featureRegistry.register(profileModule);
}
