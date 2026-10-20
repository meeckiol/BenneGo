// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const env = {
  appName: "BenneGo Driver",
  appSlug: "bennego-driver",
  scheme: "bennego",
  iosBundleId: "com.bennego.driver",
  androidPackage: "com.bennego.driver",
};

// URL du backend BenneGo (voir .env.example). Exposée à l'appli via expo-constants.
const publicRuntime = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  extra: publicRuntime,
  orientation: "portrait",
  icon: "./assets/images/bennego-icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false,
      "NSLocationWhenInUseUsageDescription": "BenneGo utilise votre position uniquement pendant une mission active.",
      // Requis pour le tracking background (watchPositionAsync en background)
      "NSLocationAlwaysAndWhenInUseUsageDescription": "BenneGo suit votre position en arrière-plan pendant une mission afin que le client puisse voir votre camion en temps réel.",
      "NSLocationAlwaysUsageDescription": "BenneGo suit votre position en arrière-plan pendant une mission afin que le client puisse voir votre camion en temps réel.",
      "UIBackgroundModes": ["location"]
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F7F3EF",
      foregroundImage: "./assets/images/bennego-icon-foreground.png",
    },
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      // Requis pour continuer le suivi GPS quand l'écran est verrouillé
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/bennego-icon.png",
  },
  plugins: [
    "expo-asset",
    "expo-router",
    [
      "expo-location",
      {
        "locationWhenInUsePermission": "BenneGo utilise votre position uniquement pendant une mission active.",
        "locationAlwaysAndWhenInUsePermission": "BenneGo suit votre position en arrière-plan pendant une mission afin que le client puisse voir votre camion en temps réel.",
        "isAndroidBackgroundLocationEnabled": true,
        "isAndroidForegroundServiceEnabled": true
      }
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/bennego-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
