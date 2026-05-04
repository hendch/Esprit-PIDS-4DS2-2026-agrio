const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

// Load .env and .env.local into process.env
for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(__dirname, envFile);

  if (!fs.existsSync(envPath)) {
    continue;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);

    if (!match) {
      continue;
    }

    const key = match[1];
    const value = (match[2] || "").replace(/^['"]|['"]$/g, "");

    // Don't overwrite already defined env vars
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

module.exports = {
  expo: {
    ...appJson.expo,

    plugins: [
      ...(appJson.expo.plugins || []),
      "@react-native-community/datetimepicker",
    ],

    extra: {
      ...(appJson.expo.extra || {}),
      googleMapsApiKey,
    },

    android: {
      ...appJson.expo.android,
      config: {
        ...(appJson.expo.android?.config || {}),
        googleMaps: {
          ...(appJson.expo.android?.config?.googleMaps || {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
  },
};