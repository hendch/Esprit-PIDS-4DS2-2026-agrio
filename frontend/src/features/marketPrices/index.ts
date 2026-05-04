import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { PricesScreen } from "../prices/PricesScreen";

export const marketPricesModule: FeatureModule = {
  id: "marketPrices",
  routes: [
    {
      name: Routes.MarketPrices,
      component: PricesScreen,
      options: { title: "Prices", headerShown: false },
    },
  ],
  dashboardEntry: {
    title: "Market Prices",
    subtitle: "Livestock & fodder price history and AI forecasts",
    routeName: Routes.MarketPrices,
    emoji: "📈",
  },
};
