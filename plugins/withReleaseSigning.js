/**
 * Expo 配置插件：让 release 版 APK 使用我们自己的固定签名密钥。
 *
 * `npx expo prebuild` 生成的 android/app/build.gradle 默认用 debug 密钥签名 release 包。
 * 这个插件改成：如果设置了环境变量 ANDROID_KEYSTORE_PATH，就用该 keystore 签名。
 * 密钥和密码只从环境变量读取（在 GitHub Actions 里来自 Secrets），绝不写进仓库。
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// [withReleaseSigning]';

const RELEASE_SIGNING_CONFIG = `
        ${MARKER}
        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }`;

function applySigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  if (!/signingConfigs\s*\{/.test(gradle)) {
    throw new Error('withReleaseSigning: 在 build.gradle 里找不到 signingConfigs 块');
  }
  let result = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_SIGNING_CONFIG}`);

  // 把 buildTypes.release 里的 "signingConfig signingConfigs.debug" 换掉
  const releaseBlock =
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseBlock.test(result)) {
    throw new Error('withReleaseSigning: 在 buildTypes.release 里找不到 signingConfig');
  }
  result = result.replace(
    releaseBlock,
    '$1signingConfig System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug'
  );
  return result;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applySigning = applySigning;
