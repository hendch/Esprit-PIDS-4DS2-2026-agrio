import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { PricesScreen } from "../prices/PricesScreen";

export const producePricesModule: FeatureModule = {
  id: "producePrices",
  routes: [
    {
      name: Routes.ProducePrices,
      component: PricesScreen,
      options: { title: "Prices", headerShown: false },
    },
  ],
  dashboardEntry: {
    title: "Produce Prices",
    subtitle: "Fruits & vegetables weekly AI forecasts",
    routeName: Routes.ProducePrices,
    emoji: "🥬",
  },
};
