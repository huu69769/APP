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
  userInterfaceStyle: 'automatic',
  android: {
    package: 'io.github.huu69769.worklogcalendar',
    versionCode: buildNumber,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // 让提醒准时响：Android 12 用 SCHEDULE_EXACT_ALARM，13 及以上日历类 app 可用 USE_EXACT_ALARM（自动允许）
    permissions: ['android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.USE_EXACT_ALARM'],
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
        // 启动画面：浅灰底 + 图标；手机是深色模式时用深藏青底（和 App 的夜间模式一致）
        backgroundColor: '#F5F7FA',
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
        dark: { backgroundColor: '#151D2A' },
      },
    ],
    'expo-sqlite',
    'expo-localization',
    'expo-notifications',
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
