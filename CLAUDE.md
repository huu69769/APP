@AGENTS.md

## 本项目约定

- 需求文档：`PRD.md`。开发者是编程初学者，每完成一个里程碑都用简单的中文说明做了什么、怎么查看效果。
- **不使用 EAS**：APK 在 GitHub Actions 里用 `expo prebuild` + `gradlew assembleRelease` 本地构建，签名由 `plugins/withReleaseSigning.js` 从环境变量读取。
- 界面文字不能写死，全部放进 `src/i18n/locales/*.json`（zh 和 ja 的键必须一致，有测试检查）。
- 界面代码只通过 `src/data/repository.ts` 读写数据，不直接用 SQLite / localStorage。
- 日期一律用本地 `YYYY-MM-DD` 字符串；金额用最小单位整数。
- 计算函数放在 `src/lib/`，必须写 Jest 测试。
- 本环境访问不了 Expo API，运行 `expo install` / `expo prebuild` / `expo export` 时加 `EXPO_OFFLINE=1`。
- 提交前运行：`npm run typecheck && npm test`
