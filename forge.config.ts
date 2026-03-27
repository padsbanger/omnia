import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import MakerPacman from "@osmn-byhn/electron-make-pacman";

import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},

  makers: [
    // Windows
    new MakerSquirrel({}),
    // Universal ZIP (safe fallback)
    new MakerZIP({}, ["darwin"]),
    new MakerZIP({}, ["linux"]),

    // Arch Linux native package (great for Omarchy)
    new MakerPacman({
      options: {
        depends: ["gtk3", "nss", "libxss", "libxtst", "alsa-lib"],
        desktopCategories: ["Utility", "Development"],
        // icon: "/absolute/path/to/your/icon.png",   // optional but recommended
      },
    }),
  ],

  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "padsbanger",
          name: "omnia",
        },
        prerelease: false,
        draft: false,
      },
    },
  ],

  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
