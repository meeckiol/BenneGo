// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const env = {
  appName: "LogiTruck Driver",
  appSlug: "logitruck-driver",
  scheme: "logitruck",
  iosBundleId: "com.logitruck.driver",
  androidPackage: "com.logitruck.driver",
};

// URL du backend LogiTruck (voir .env.example). Exposée à l'appli via expo-constants.
const publicRuntime = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  extra: publicRuntime,
  orientation: "portrait",
  icon: "./assets/images/logitruck-icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false,
      "NSLocationWhenInUseUsageDescription": "LogiTruck utilise votre position uniquement pendant une mission active.",
      // Requis pour le tracking background (watchPositionAsync en background)
      "NSLocationAlwaysAndWhenInUseUsageDescription": "LogiTruck suit votre position en arrière-plan pendant une mission afin que le client puisse voir votre camion en temps réel.",
      "NSLocationAlwaysUsageDescription": "LogiTruck suit votre position en arrière-plan pendant une mission afin que le client puisse voir votre camion en temps réel.",
      "UIBackgroundModes": ["location"]
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F7F3EF",
      foregroundImage: "./assets/images/logitruck-icon-foreground.png",
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
    favicon: "./assets/images/logitruck-icon.png",
  },
  plugins: [
    "expo-asset",
    "expo-router",
    [
      "expo-location",
      {
        "locationWhenInUsePermission": "LogiTruck utilise votre position uniquement pendant une mission active.",
        "locationAlwaysAndWhenInUsePermission": "LogiTruck suit votre position en arrière-plan pendant une mission afin que le client puisse voir votre camion en temps réel.",
        "isAndroidBackgroundLocationEnabled": true,
        "isAndroidForegroundServiceEnabled": true
      }
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/logitruck-icon.png",
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
