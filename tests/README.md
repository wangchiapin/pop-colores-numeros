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
| `test_colores_rules.js` | 教師區常駐「訂閱規則說明」：免費／訂閱帳號、繁簡與西英小字、關閉外語時不顯示小字，並檢查規則寫的額度（3／15）等於程式實際上限 |

## 沒有涵蓋的

- **Firestore 安全規則**（例如到期後哪些連結會被擋）：請用非管理員帳號在實機測。
- 遊戲本身（消除、計分、排行榜）與班級成績冊：尚無自動測試。
