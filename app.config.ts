import type { ExpoConfig } from 'expo/config';

// 版本号由 GitHub Actions 通过环境变量传入（每次构建自动 +1）。
// 本地开发时没有这些变量，就用默认值。
const buildNumber = Number(process.env.APP_BUILD_NUMBER ?? '1');
const version = process.env.APP_VERSION ?? '0.1.0';

const config: ExpoConfig = {
  name: '打工日历',
  slug: 'worklog-calendar',
  version,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'worklogcalendar',
  userInterfaceStyle: 'light',
  android: {
    package: 'io.github.huu69769.worklogcalendar',
    versionCode: buildNumber,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // 单页应用：GitHub Pages 上用 404.html 兜底，任何路径都能打开
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-sqlite',
    'expo-localization',
    './plugins/withReleaseSigning.js',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    // GitHub Pages 的网址是 /<仓库名>/ 子路径，不设置会白屏。
    // Actions 里会传入 EXPO_BASE_URL=/APP；本地开发保持为空。
    baseUrl: process.env.EXPO_BASE_URL || undefined,
  },
};

export default config;
