import 'dotenv/config';

// Debug logging

export default {
  expo: {
    name: "GearMeUp-native",
    slug: "GearMeUp-native",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gearmeup.native",
      infoPlist: {
        "NSLocationWhenInUseUsageDescription": "We need your location to show nearby places",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "We need your location to show nearby places",
        "UIBackgroundModes": ["location", "fetch"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.gearmeup.native",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ]
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png"
    },
    extra: {
      mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    },
    plugins: [
      "expo-router",
      [
        "@rnmapbox/maps",
        {
          "locationWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location."
        }
      ]
    ]
  }
};

