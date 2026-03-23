import type { FeatureModule } from "./FeatureModule";

class FeatureRegistry {
  private modules: FeatureModule[] = [];

  register(module: FeatureModule) {
    const exists = this.modules.some((m) => m.id === module.id);
    if (exists) return; // already registered (e.g. hot reload or Strict Mode)
    this.modules.push(module);
  }

  listModules() {
    return [...this.modules];
  }

  listRoutes() {
    return this.modules.flatMap((m) => m.routes);
  }

  listDashboardEntries() {
    return this.modules
      .map((m) => m.dashboardEntry)
      .filter(Boolean)
      // TS narrowing
      .map((e) => e!);
  }

  async initAll() {
    for (const m of this.modules) {
      if (m.init) await m.init();
    }
  }
}

export const featureRegistry = new FeatureRegistry();
