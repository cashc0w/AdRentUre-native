const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add support for Expo assets
config.resolver.assetExts.push('png', 'jpg', 'jpeg', 'gif', 'webp');

// Add support for Expo Router
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = withNativeWind(config, { input: './globals.css' });