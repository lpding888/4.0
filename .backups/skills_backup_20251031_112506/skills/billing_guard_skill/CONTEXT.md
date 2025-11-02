### 1) 供应商与成本模型（示意）

* **RunningHub**：按调用计费 `pricePerCallUSD`；
* **Hunyuan/腾讯云**：按 Token/字符/时长；
* **COS**：存储 + 外网下行；
* **SCF**：请求次数 + 计算时长 + 内存档位；
* **Redis/MySQL**：实例费用摊销（按月均分）。

`billing/cost-models/providers.json`（示意）

```json
{
  "runninghub": { "unit": "call", "pricePerCallUSD": 0.002 },
  "hunyuan":    { "unit": "token", "inputUSDPerKT": 0.0015, "outputUSDPerKT": 0.0020 },
  "tencentai":  { "unit": "second", "pricePerSecondUSD": 0.00005 },
  "cos":        { "unit": "gb_month", "storageUSDPerGB": 0.02, "egressUSDPerGB": 0.08 },
  "scf":        { "unit": "gb_sec", "usdPerGBSec": 0.00001667, "invokeUSD": 0.0000004 }
}
```

### 2) 预算策略（YAML）

`billing/policies/cms.yaml`

```yaml
project: CMS
weeklyBudgetUSD: 200
perFeature:
  cms.core: { maxCostUSD: 80, warnAt: 0.8 }
  cms.media: { maxCostUSD: 70, warnAt: 0.75 }
  cms.search: { maxCostUSD: 50, warnAt: 0.8 }
rules:
  - id: R1
    match: { endpoint: "/ai/*" }
    action: { cache: { ttlSec: 300 }, debounceMs: 500 }
  - id: R2
    match: { provider: "hunyuan", model: "xlarge" }
    action: { downgradeTo: "medium" }
```

### 3) 埋点与采集

* **后端**：在调用前后记录：`provider/model/reqSize/resSize/latency/cost`；
* **前端**：对可能触发 AI 调用的按钮加 `data-costRisk` 标签 + 节流；
* **SCF**：记录 `gbSec`、调用次数、重试率。

### 4) 触发与阻断

* **预警**：80% 阈值 → Slack/飞书通知 + 创建建议卡（G-...）；
* **阻断**：100% → 返回业务错误码 `42901 budget_exceeded`，同时 `BILLING_BUDGET_EXCEEDED` 事件。
