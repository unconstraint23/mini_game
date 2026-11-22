import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.neuropulse.focus",
  appName: "NeuroPulse",
  webDir: "dist",
  backgroundColor: "#070B14",
  android: {
    allowMixedContent: false,
    backgroundColor: "#070B14",
    buildOptions: {
      releaseType: "APK",
    },
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#070B14",
    preferredContentMode: "mobile",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#070B14",
    },
  },
};

export default config;
