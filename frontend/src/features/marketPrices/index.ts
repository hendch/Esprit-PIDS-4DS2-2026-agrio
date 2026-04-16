import type { FeatureModule } from "../../core/featureRegistry/FeatureModule";
import { Routes } from "../../core/navigation/routes";
import { MarketPricesScreen } from "./MarketPricesScreen";

export const marketPricesModule: FeatureModule = {
  id: "marketPrices",
  routes: [
    {
      name: Routes.MarketPrices,
      component: MarketPricesScreen,
      options: { title: "Market Prices", headerShown: false },
    },
  ],
  dashboardEntry: {
    title: "Market Prices",
    subtitle: "Livestock price history & AI-powered forecasts",
    routeName: Routes.MarketPrices,
    emoji: "📈",
  },
};
