import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { registerFeatures } from "./registerFeatures";
import { featureRegistry } from "../core/featureRegistry/FeatureRegistry";

export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        registerFeatures();
        await featureRegistry.initAll();
        setReady(true);
      } catch (e: any) {
        setError(e?.message ?? "Bootstrap failed");
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>AGRIO failed to start</Text>
        <Text selectable>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12 }}>Starting AGRIO…</Text>
      </View>
    );
  }

  return <>{children}</>;
}
