import React from "react";
import { View, Text } from "react-native";

export function FarmTrustLedgerScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>FarmTrust Ledger</Text>
      <Text style={{ marginTop: 8, color: "#555" }}>
        Stub screen — will later store tamper-evident logs (hash chain), proofs, exports.
      </Text>
    </View>
  );
}
