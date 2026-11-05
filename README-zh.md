# DSH 插件：莱德-韦特-史密斯塔罗

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=Firefox2100_dsh-rws-tarot&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Firefox2100_dsh-rws-tarot) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Firefox2100_dsh-rws-tarot&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Firefox2100_dsh-rws-tarot) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Firefox2100_dsh-rws-tarot&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Firefox2100_dsh-rws-tarot)

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供的莱德-韦特-史密斯塔罗插件：在右侧面板摆开牌阵，逐张翻牌，并依据亚瑟·爱德华·韦特的《塔罗图解》（*The Pictorial Key to the Tarot*，1910 年，已进入公有领域）解读每一张。抽牌、牌义与占法由程序提供，语言模型只在这些事实之上做推理。

仅供娱乐、学习与自我反思之用。它不能预测，也不能解读现实中的事件，更不应作为决策的依据；请见下方的[免责声明](#免责声明)。

## 安装

```bash
dsh plugin --profile <profile> add dsh-rws-tarot
```

需要 DeepSeek Harness `>=0.2.2-rc.1 <0.2.3`，以及该 profile 已经可以使用的模型。功能、用法、配置和 `/tarot` 命令见[插件 README](packages/tarot/README.md)（英文）。

## 主要功能

- **六种抽牌方式。** 书中的三种方法（凯尔特十字、42 张的“另一种占法”、35 张的延续占法），1 至 12 张的自由抽牌，以及现代做法中的两种牌阵：三张牌（过去、现在、未来）和九张牌（3 × 3）。
- **右侧面板页面。** 牌阵以牌背朝上的方式摆开，下一张该翻的牌会发光，只有它可以点击；牌面是书中印刷的潘米拉·科尔曼·史密斯的插图。
- **一次翻一张。** 每翻开一张，该牌及其位置、书中的牌义和桌面上已有的牌会交给对话，模型随即为它作答；最后一张翻开后，模型会把整个牌阵合起来解读。
- **以书中的原话为准。** 牌义、位置说明和占法都出自《塔罗图解》，由程序提供，绝不让模型凭记忆回忆；书中没有的内容保持为空，不从别处补充。
- **逆位、同阶重复与重复占卜。** 可选的逆位牌；同一阶数的牌出现两张、三张或四张时的书中说明；以及书中对存疑的第十张牌所建议的后续做法。
- **读牌结果会保留。** 一次占卜保存在它所在的对话中，刷新页面或重启后依然在；一个会话可以容纳任意多次占卜。
- **命令与工具。** `/tarot` 可在输入框中完成所有步骤；你在对话中提出要求时，模型也可以用 `tarot_lay_spread` 工具摆牌。
- **语言。** 页面、牌名和位置名以及给模型的指令支持中文和英文，其他语言回退为英文；插件在“插件”页面中的名称和说明已翻译为界面提供的所有语言。
- **不改动宿主。** 插件只增加一个页面和它自己工具的一行显示，不替换宿主的任何内容。

## 仓库结构

| 路径 | 内容 |
|---|---|
| `packages/tarot` | 插件本体（宿主端与客户端）。 |
| `packages/tarot-data` | 书中的牌、占法和重复规则数据，以及牌名。 |
| `packages/tarot-engine` | 确定性引擎：洗牌、牌阵、交给模型的事实。 |
| `references/pictorial-key` | 这本书：按部分分开的文本、78 张插图，以及用来核对数据的扫描版 PDF。 |
| `scripts` | 数据生成与核对脚本。 |

两个库已打包进插件。

## 开发

```bash
pnpm install
pnpm typecheck        # 需要 NODE_OPTIONS=--max-old-space-size=12288
pnpm test
node scripts/check-cards.mjs
node scripts/check-methods.mjs
pnpm --filter dsh-rws-tarot build
```

牌的数据由书中文本生成（`node scripts/build-cards.mjs`、`node scripts/build-recurrence.mjs`）；数据与书不一致时，核对脚本会报错。更多内容见[插件 README](packages/tarot/README.md#development)（英文）。

## 免责声明

塔罗是一种以象征与反思为特点的传统实践。本插件遵循已有文献记载并公开出版的惯例：韦特 1910 年的书中的牌义与占法，以及三张牌、九张牌牌阵所依据的现代通行做法。它不能、也不会预测或解读任何人生活中的现实事件。

- 牌由软件随机抽取，与你的实际处境没有任何联系；模型给出的解读是依据书中措辞生成的文字，并非对你个人情况的洞察。语言模型也可能出错、前后不一致或产生误导。
- 请勿把解读结果当作健康、医疗、心理健康、法律、金钱、感情、人身安全或其他重要事项的决策依据。遇到这类问题，请咨询有资质的专业人士。
- 本插件仅供娱乐、学习和个人反思之用。你对自己的决定和行为负全部责任。
- 本软件按“现状”提供，不附带任何形式的担保，遵循 GPL-3.0 许可。

基于 GPL-3.0-only 许可发布。
