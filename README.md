# 打工日历

自用的安卓日历 app：记录日程、笔记和兼职班次，首页直接看到本月的打工时长、工钱和空闲时间。
完整需求见 [PRD.md](PRD.md)。

- 网页版预览（只用于看界面，数据和手机上的分开）：<https://huu69769.github.io/APP/>
- 下载 APK：<https://github.com/huu69769/APP/releases>
- 第一次发布前的设置（签名密钥、Pages）：[docs/发布设置.md](docs/发布设置.md)

## 开发进度

- [x] **M1 框架**：Expo 项目、多语言、存储抽象层、自动构建与发布、首页空白月历
- [x] **M2 打工**：兼职管理、班次模板、录入（一键 / 批量 / 手动）、月历色块
- [x] **M3 统计**：统计栏、统计详情、年度累计、两种周期、两种工钱显示
- [x] **时间待定的班次**：知道要上班、还不知道几点时先标记
- [x] **按项目结算的兼职**：每个项目记一笔报酬（截止日 + 报酬），收入按交付日计算
- [ ] M4 日程、笔记、提醒
- [ ] M5 节假日、农历
- [ ] M6 备份、设置页、日文检查

## 在电脑上运行

需要 Node.js 22。

```bash
npm install
npm run web        # 在浏览器里打开网页版
npm start          # 用手机上的 Expo Go 扫码预览
npm test           # 运行单元测试
npm run typecheck  # 类型检查
npm run format     # 统一代码格式（Prettier）
```

## 代码结构

```
src/
  app/            页面（expo-router：每个文件就是一个页面）
    index.tsx       首页（月历、批量排班）
    day/[date].tsx  当天详情页（班次列表、一键添加）
    jobs/           兼职列表、编辑兼职（含班次模板）
    templates/      编辑班次模板
    shift/          手动添加 / 编辑班次
    task/           按件计酬的任务
    stats.tsx       统计详情（按兼职、空闲时间、年度累计）
  components/     界面组件（月历等）
  data/           数据层
    types.ts        数据表的类型
    repository.ts   repository 层：界面只通过它读写数据
    settings.ts     设置（键值对）
    shifts.ts       创建班次（时薪快照）、批量排班、时间待定
    tasks.ts        按件计酬的任务
    useQuery.ts     读取数据，数据变化时自动刷新
    useStats.ts     读取统计数据
    storage/        底层存储：手机用 SQLite，网页用浏览器存储
  i18n/           多语言，界面文字都在 locales/*.json 里
  lib/            纯计算函数（都有单元测试）：日期、月历、时长、工钱、金额、
                  统计周期（period.ts）、统计与空闲时间（stats.ts）
  theme/          颜色
plugins/          Expo 配置插件（release 签名）
.github/workflows 自动构建与发布
```
