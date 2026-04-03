// Metro config for the Expo app (run from ./frontend).
// Registers .tflite so the disease-detection model is bundled as an asset.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("tflite");

module.exports = config;
