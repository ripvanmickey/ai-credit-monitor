# 半导体与算力信用研究

跟踪 AI 算力产业链信用风险、费城半导体指数的历史恢复周期，以及 AI 基础设施建设的周期信号。网站支持中文、English 和日本語。

## 在线面板

| 页面 | 内容 |
| --- | --- |
| [CDS 与信用利差监测](https://ripvanmickey.github.io/ai-credit-monitor/) | 比较公司 5 年期美元 CDS 和公司债相对同日 5 年期美债的收益率利差。公开报价、DTCC 成交中位数和媒体报道按口径分别展示。 |
| [半导体指数回测](https://ripvanmickey.github.io/ai-credit-monitor/sox/) | 统计 SOX 跌破 200 日均线后首次站回、连续 5 个交易日确认站回和收复历史前高所需时间，以及期间跌幅和站稳后 1、3、6、12 个月的收益分布。 |
| [AI 建设见顶信号](https://ripvanmickey.github.io/ai-credit-monitor/cycle/) | 跟踪 GPU 租金、云厂商信用、未履约订单和芯片厂商应收账款周转天数（DSO）。 |

## 数据更新

[GitHub Actions](https://github.com/ripvanmickey/ai-credit-monitor/actions) 配置为每 3 小时用仓库中的已保存数据重新生成并发布静态快照。行情和财报的实际日期以图表标注为准。重新生成网页本身不会拉取新报价，更新数据需先更新源码包中的快照。

## 本地运行

下载并解压 [research-source.zip](./research-source.zip)，在解压后的项目目录中使用 Node.js 24 和 pnpm 10 运行：

```sh
pnpm install --frozen-lockfile
node scripts/build-pages.mjs
pnpm dev
```

浏览器访问 [http://127.0.0.1:8788](http://127.0.0.1:8788)。GitHub Pages 的静态构建产物在 `dist/pages/`。
