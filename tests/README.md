# 測試

用 Playwright 開真正的瀏覽器，Firebase（modular v10）由 `test_colores_rules.js` 內建的替身取代，**不會碰到真的資料庫**。

## 執行

```
npm i -D playwright && npx playwright install chromium   # 第一次
node tests/run.js
```

`run.js` 會自己開靜態伺服器，依序跑 `tests/test_*.js`，有任何一項失敗就以非 0 結束。

## 內容

| 檔案 | 測什麼 |
|---|---|
| `test_game.js` | 步驟 5-3：共用 ⚙️ 設定（預設、從 `shushu_cfg` 搬過來、跟跑吧共用、保留別款欄位）、⚙️ 視窗與遊戲中暫停、拼音／注音（顏色按鈕、數字鍵、題目文字、老師自訂顏色的 `p`、「一百」唸 yì）、五級評語與結果畫面順序、班級成績回傳訊息、教師區已刪除 |

## 沒有涵蓋的

- **Firestore 安全規則**（例如到期後哪些連結會被擋）：請用非管理員帳號在實機測。
- 消除與計分的細節、排行榜上傳：尚無自動測試。
