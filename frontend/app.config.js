const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(__dirname, envFile);
  if (!fs.existsSync(envPath)) {
    continue;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = (match[2] || "").replace(/^['"]|['"]$/g, "");
  }
}

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: appJson.expo.plugins || [],
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
