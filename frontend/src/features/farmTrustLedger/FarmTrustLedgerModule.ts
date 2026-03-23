import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { FarmTrustLedgerScreen } from "./FarmTrustLedgerScreen";

export const farmTrustLedgerModule: FeatureModule = {
  id: "farmTrustLedger",
  routes: [{ name: Routes.FarmTrustLedger, component: FarmTrustLedgerScreen, options: { title: "Ledger" } }],
  // No dashboardEntry on purpose (hidden until you want it)
};
