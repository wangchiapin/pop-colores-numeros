// 局內流程與記錄：愛心 0／3／5、提示、暫停鈕、重來、回主選單、排行榜（上傳與各種情況）、舊式 ?t= 連結
// 用法：node tests/run.js
const H = require('./helpers');
const { ok, open, txt } = H;

const MENU = '#ctl button:nth-child(3)', RESTART = '#ctl button:nth-child(2)';
const dataKeys = (page, prefix) => page.evaluate(p => Object.keys(window.__DATA).filter(k => k.startsWith(p)), prefix);
const data = (page, k) => page.evaluate(k => window.__DATA[k], k);
const calm = page => page.waitForFunction(() => S && !S.busy);          // 答對後要等 650ms 下一題才出現
async function correctN(page, n){ const out = []; for(let i = 0; i < n; i++){ const q = await page.evaluate(() => S.qid); out.push(await H.answerA(page)); await H.waitQ(page, q); } return out; }
function seedBoard(id, list){ const o = {}; list.forEach(([uid, name, score, secs]) => { o['colorgame_boards/' + id + '/entries/' + uid] = { name, score, secs, hearts: 2, cleared: false, rank: score * 100000 + (99999 - secs) }; }); return o; }
const tenOthers = (id, score, prefix) => seedBoard(id, Array.from({ length: 10 }, (_, i) => ['o' + i, prefix + (i + 1), score + i, 100]));
const cfgLs = o => ({ shushu_cfg: JSON.stringify(o) });

(async () => {
  const browser = await H.chromium.launch();

  console.log('\n[H1] 愛心 3（老師連結）：扣到 0 就結束');
  const L3 = '?t=' + H.b64url({ name: '三命', mode: 'A', rows: 3, cols: 3, hearts: 3, ids: ['red', 'blue', 'green'] });
  { const { page, ctx, errors } = await open(browser, { qs: L3 });
    await page.waitForFunction(() => screen === 'link');
    const sum = await txt(page, '#app .panel .note');
    ok(sum.includes('3×3') && sum.includes('♥3'), '連結開始畫面摘要：3×3、♥3', sum);
    await H.startStd(page);
    ok(await page.$$eval('#board .cell', e => e.length) === 9 && await H.hudHearts(page) === '♥♥♥', '連結的設定生效：9 格、3 顆愛心');
    ok(await page.$$eval('.cbtn', e => e.length) === 3, '顏色只有連結指定的 3 種');
    await H.answerA(page, { correct: false });
    ok(await H.hudHearts(page) === '♥♥♡', '答錯一次 → ♥♥♡');
    await H.answerA(page, { correct: false });
    ok(await H.hudHearts(page) === '♥♡♡' && await page.evaluate(() => !S.ended), '答錯兩次 → ♥♡♡，還沒結束');
    await H.answerA(page, { correct: false });
    await page.waitForSelector('#over:not(.hide)');
    ok((await txt(page, '#over h1')) === '愛心用完了 Sin vidas', '第三次答錯 → 結束「愛心用完了」', await txt(page, '#over h1'));
    ok((await txt(page, '#over table')).includes('愛心 · Vidas 0'), '結算：愛心 0', await txt(page, '#over table'));
    ok((await txt(page, '#commentLine')).includes('沒關係，再試一次'), '評語：沒清掉幾格 → 沒關係再試一次');
    ok(await txt(page, '#over .total') === '0', '一題都沒答對 → 總分 0');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[H2] 愛心 0（無限）：怎麼錯都不會結束；提示；清完沒有愛心獎勵');
  { const { page, ctx, errors } = await open(browser, { qs: '?t=' + H.b64url({ mode: 'A', rows: 3, cols: 3, hearts: 0, ids: ['red', 'blue', 'green'] }) });
    await page.waitForFunction(() => screen === 'link');
    ok((await txt(page, '#app .panel .note')).includes('♥∞'), '連結摘要顯示 ♥∞');
    await H.startStd(page);
    ok(await H.hudHearts(page) === '∞', '遊戲中愛心欄顯示 ∞');
    for(let i = 0; i < 3; i++){ await H.answerA(page, { correct: false }); await page.waitForTimeout(30); }
    ok(await page.$('.cell.hint') !== null, '連錯 3 次 → 正確方塊閃提示框');
    ok((await txt(page, '#toast')).includes('提示：這題不給分'), '跳出「提示：這題不給分」', await txt(page, '#toast'));
    for(let i = 0; i < 9; i++){ await H.answerA(page, { correct: false }); await page.waitForTimeout(30); }
    ok(await H.hudHearts(page) === '∞' && await page.evaluate(() => !S.ended), '一共答錯 12 次，愛心還是 ∞、遊戲沒結束');
    ok(await H.hudScore(page) === 0, '一直答錯，分數停在 0 不會變負');
    const q = await page.evaluate(() => S.qid);
    await H.answerA(page);
    ok((await txt(page, '#toast')) === '+0' && await H.hudScore(page) === 0, '提示題答對：+0 分');
    await H.waitQ(page, q);
    ok(await page.$('.cell.hint') === null, '下一題提示框消失');
    const q2 = await page.evaluate(() => S.qid);
    await H.answerA(page);
    ok(await H.hudScore(page) >= 10, '下一題恢復算分（≥10）', await H.hudScore(page));
    await H.waitQ(page, q2);
    await H.clearBoard(page, 'A');
    await page.waitForSelector('#over:not(.hide)');
    const tbl = await txt(page, '#over table');
    ok((await txt(page, '#over h1')).startsWith('全部清除'), '清完 → 全部清除');
    ok(tbl.includes('清盤獎勵') && tbl.includes('+50'), '有清盤獎勵 +50', tbl);
    ok(!tbl.includes('愛心獎勵'), '愛心 0（無限）：沒有愛心獎勵這一列', tbl);
    ok(tbl.includes('∞'), '結算愛心欄顯示 ∞', tbl);
    ok((await txt(page, '#commentLine')).includes('全部清完，太厲害了'), '無限愛心清完 → 評語是「太厲害了」（沒有「完美」）');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[H3] 愛心 5（預設）：提示、扣滿 5 顆結束');
  { const { page, ctx, errors } = await open(browser);
    await H.startStd(page);
    await correctN(page, 1);
    await calm(page);
    const before = await H.hudScore(page);
    ok(before >= 10, '先答對一題：有分數', before);
    for(let i = 0; i < 3; i++){ await H.answerA(page, { correct: false }); await page.waitForTimeout(30); }
    ok(await H.hudHearts(page) === '♥♥♡♡♡', '答錯 3 次 → ♥♥♡♡♡', await H.hudHearts(page));
    ok(await page.$('.cell.hint') !== null, '連錯 3 次 → 閃提示框');
    ok(await H.hudScore(page) === Math.max(0, before - 15), '每次答錯扣 5 分（最低 0）', [before, await H.hudScore(page)]);
    const sc = await H.hudScore(page);
    await H.answerA(page);
    ok((await txt(page, '#toast')) === '+0' && await H.hudScore(page) === sc, '提示題答對不給分', await txt(page, '#toast'));
    await H.waitQ(page, await page.evaluate(() => S.qid - 1));
    await H.answerA(page, { correct: false }); await page.waitForTimeout(30);
    ok(await H.hudHearts(page) === '♥♡♡♡♡' && await page.evaluate(() => !S.ended), '再錯一次 → ♥♡♡♡♡，還沒結束');
    await H.answerA(page, { correct: false });
    await page.waitForSelector('#over:not(.hide)');
    ok((await txt(page, '#over table')).includes('愛心 · Vidas 0'), '第 5 次答錯 → 愛心 0 → 結束');
    ok((await txt(page, '#over h1')).startsWith('愛心用完了'), '標題：愛心用完了');
    ok(await page.evaluate(() => S.ended) && await page.$eval('#over', e => !e.classList.contains('hide')), '結算畫面出現');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[P] 暫停鈕');
  { const { page, ctx, errors } = await open(browser);
    await H.startStd(page);
    ok((await txt(page, '#pbtn')).includes('暫停'), '暫停鈕文字：暫停');
    await page.waitForTimeout(1100);
    ok(await txt(page, '#tm') === '0:01', '玩了約 1 秒 → 計時 0:01', await txt(page, '#tm'));
    const spokenN = await page.evaluate(() => window.__spoken.length);
    await page.click('#pbtn');
    ok(await page.$eval('#cover', e => e.classList.contains('show')) && await page.evaluate(() => S.paused), '按暫停 → 蓋住盤面、遊戲暫停');
    ok((await txt(page, '#pbtn')).includes('繼續') && (await txt(page, '#cover')).includes('已暫停'), '按鈕變「繼續」，蓋板寫「已暫停」', await txt(page, '#cover'));
    await H.answerA(page, { correct: false });
    ok(await H.hudHearts(page) === '♥♥♥♥♥' && await H.hudScore(page) === 0, '暫停中按顏色按鈕：不扣愛心、不算分');
    await page.click('#qbar button');
    ok(await page.evaluate(() => window.__spoken.length) === spokenN, '暫停中按「重播」不會唸');
    await page.waitForTimeout(1500);
    ok(await txt(page, '#tm') === '0:01', '暫停 1.5 秒，計時沒走（還是 0:01）', await txt(page, '#tm'));
    await page.click('#cover button');
    ok(!(await page.$eval('#cover', e => e.classList.contains('show'))) && await page.evaluate(() => !S.paused), '按「繼續」→ 蓋板消失、遊戲繼續');
    ok((await txt(page, '#pbtn')).includes('暫停'), '按鈕變回「暫停」');
    await page.waitForFunction(n => window.__spoken.length > n, spokenN, { timeout: 2000 }).catch(() => {});
    ok(await page.evaluate(() => window.__spoken.length) === spokenN + 1, '繼續後重唸一次題目');
    await page.waitForTimeout(1150);
    const tm = await txt(page, '#tm');
    ok(tm === '0:02' || tm === '0:03', '繼續後再玩 1 秒 → 計時 0:02（暫停那段不算）', tm);
    const r = await H.answerA(page);
    ok(r.match && await H.hudScore(page) >= 10, '暫停後答題正常算分');
    await page.waitForTimeout(150);
    const q = await page.evaluate(() => S.qid);
    await page.click('#pbtn');
    await page.waitForTimeout(1000);
    ok(await page.evaluate(q => S.qid === q, q), '答對動畫中途按暫停 → 下一題等到繼續才出現');
    await page.click('#cover button');
    await H.waitQ(page, q);
    ok(await page.evaluate(q => S.qid === q + 1 && !S.paused, q), '按繼續 → 下一題出現');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: cfgLs({ mode: 'B' }) });
    await H.startStd(page);
    await page.click('#pbtn');
    await page.click('.key:nth-child(2)');
    ok(await txt(page, '#inbox') === '', 'B：暫停中按數字鍵沒反應');
    await page.click('#cover button');
    await page.click('.key:nth-child(2)');
    ok(await txt(page, '#inbox') === '一', 'B：繼續後數字鍵恢復');
    await ctx.close(); }

  console.log('\n[R] 重來、回主選單');
  { const { page, ctx, errors } = await open(browser);
    await H.startStd(page);
    await correctN(page, 2); await calm(page);
    const sc = await H.hudScore(page), alive = (await H.cellsInfo(page)).filter(c => c.alive).length;
    await page.click(RESTART);
    ok(!(await H.hidden(page, '#confirm')) && await page.evaluate(() => S.paused), '按「重新開始」→ 跳出確認、遊戲先暫停');
    ok((await txt(page, '#confirmText')).includes('確定要重新開始嗎'), '確認文字：確定要重新開始嗎', await txt(page, '#confirmText'));
    await page.click('#cNo');
    ok(await H.hidden(page, '#confirm') && await page.evaluate(() => !S.paused), '按取消 → 關掉確認、遊戲繼續');
    ok(await H.hudScore(page) === sc && (await H.cellsInfo(page)).filter(c => c.alive).length === alive, '取消後分數與盤面不變', [sc, alive]);
    await page.click('#pbtn');
    await page.click(RESTART); await page.click('#cNo');
    ok(await page.evaluate(() => S.paused), '本來就暫停時按重新開始再取消 → 仍維持暫停');
    await page.click('#cover button');
    await page.click(RESTART); await page.click('#cYes');
    await H.waitQ(page, 0);
    ok(await page.evaluate(() => S.score === 0 && S.hearts === 5 && S.cells.every(c => c.alive) && S.qid === 1 && !S.paused), '確定重新開始：分數 0、愛心 5、20 格全新、第 1 題');
    ok(await H.hudScore(page) === 0 && await txt(page, '#tm') === '0:00', '畫面分數 0、時間 0:00');
    ok(await H.hidden(page, '#confirm') && await H.hidden(page, '#over'), '確認視窗與結算視窗都關著');
    const plays = await page.evaluate(() => Object.entries(window.__DATA).filter(([k]) => k.startsWith('plays/')).map(([, v]) => v));
    ok(plays.length === 2 && plays.every(p => p.done === false), '重來不算玩完：兩筆遊玩紀錄都還是「沒玩完」', plays.map(p => p.done));
    ok((await dataKeys(page, 'colorgame_boards')).length === 0, '重來不會寫進排行榜');
    await correctN(page, 1); await calm(page);
    await page.click(MENU);
    ok(!(await H.hidden(page, '#confirm')) && (await txt(page, '#confirmText')).includes('確定要回主選單嗎'), '按「主選單」→ 確認（確定要回主選單嗎）');
    await page.click('#cNo');
    ok(await page.$('#board') !== null && await page.evaluate(() => S && !S.paused), '取消 → 留在遊戲裡繼續');
    await page.click(MENU); await page.click('#cYes');
    ok(await page.evaluate(() => S === null && screen === 'setup'), '確定 → 回主選單，遊戲狀態清掉');
    ok(await page.$('#board') === null && await H.hidden(page, '#over') && await H.hidden(page, '#confirm'), '遊戲畫面、結算、確認視窗都沒了');
    ok((await txt(page, '#app h1')) === '色數消消樂' && await H.isOn(page, '5×4'), '主選單畫面與先前選項還在');
    ok((await dataKeys(page, 'colorgame_boards')).length === 0, '中途離開不記成績');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { // 結算畫面的「主選單」；連結模式回到連結開始畫面且名字還在
    const { page, ctx } = await open(browser, { qs: L3 });
    await page.waitForFunction(() => screen === 'link');
    await page.fill('#app input.txt', 'Ana');
    await H.startStd(page);
    await page.click(MENU); await page.click('#cYes');
    ok(await page.evaluate(() => screen === 'link' && S === null), '連結模式按主選單 → 回到連結開始畫面');
    ok(await page.$eval('#app input.txt', e => e.value) === 'Ana' && (await txt(page, '#app .panel')).includes('三命'), '名字「Ana」與連結名稱「三命」還在');
    await H.startStd(page);
    await H.loseA(page, 3);
    await page.locator('#over .big', { hasText: '主選單' }).click();
    ok(await H.hidden(page, '#over') && await page.evaluate(() => screen === 'link'), '結算畫面的「主選單」也回到連結開始畫面');
    await ctx.close(); }

  console.log('\n[L] 排行榜');
  { // 1) 空榜：進榜 → 空暱稱不上傳 → 暱稱超過 12 字會被截 → 上傳寫進 Firestore
    const { page, ctx, errors } = await open(browser);
    await H.startStd(page);
    await correctN(page, 6); await calm(page);
    await H.loseA(page, 5);
    const total = Number(await txt(page, '#over .total'));
    ok(total > 0, '玩到結束且有分數', total);
    await page.waitForSelector('#lbArea #nick');
    ok((await txt(page, '#lbArea')).includes('進榜了'), '空榜單：顯示「進榜了！輸入暱稱上傳成績」');
    await page.click('#upBtn');
    ok((await dataKeys(page, 'colorgame_boards')).length === 0 && await page.$('#nick') !== null, '暱稱空白按上傳：不寫入、輸入框還在');
    await page.fill('#nick', '一二三四五六七八九十甲乙丙丁戊'); await page.dispatchEvent('#nick', 'input');
    ok((await page.$eval('#nick', e => [...e.value].length)) === 12, '暱稱超過 12 字自動截成 12 字');
    await page.click('#upBtn');
    await page.waitForFunction(() => document.getElementById('lbArea').innerText.includes('已上傳'));
    const e = await data(page, 'colorgame_boards/A_20_basic_999/entries/anon');
    ok(e && e.name === '一二三四五六七八九十甲乙' && e.score === total && e.cleared === false && e.hearts === 0, '寫入 A_20_basic_999：暱稱(12字)、總分、愛心 0、未清盤', e);
    ok(e && e.rank === e.score * 100000 + (99999 - e.secs) && e.secs >= 0, '排名值公式正確', e);
    ok(await page.evaluate(() => localStorage.getItem('shushu_nick')) === '一二三四五六七八九十甲乙', '暱稱記在 shushu_nick');
    ok(await page.$eval('#lbArea tr.me', r => r.innerText.includes('一二三四五六七八九十甲乙') && r.innerText.includes(String(Number(document.querySelector('#over .total').innerText)))), '榜上自己的那一列有暱稱與分數');
    await page.click('#over .big:not(.sec)');
    await H.waitQ(page, 0);
    await H.loseA(page, 5);   // 一題都沒答對 → 0 分
    await page.waitForFunction(() => document.getElementById('lbArea').innerText.includes('沒進前 10'));
    ok((await txt(page, '#over .total')) === '0', '0 分：顯示「沒進前 10，再加油」不給上傳');
    ok(await page.$('#nick') === null, '0 分沒有暱稱輸入框');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { // 2) 榜上已滿 10 個高分 → 沒進前 10
    const { page, ctx } = await open(browser, { ls: cfgLs({ grid: 1 }), data: tenOthers('A_30_basic_999', 90000, 'Top') });
    await H.startStd(page); await correctN(page, 6); await calm(page); await H.loseA(page, 5);
    await page.waitForFunction(() => !document.getElementById('lbArea').innerText.includes('讀取中'));
    ok(Number(await txt(page, '#over .total')) > 0, '分數大於 0（排除 0 分的情況）');
    ok((await txt(page, '#lbArea')).includes('沒進前 10') && await page.$('#nick') === null, '分數比第 10 名低 → 「沒進前 10」，沒有輸入框');
    ok(await page.$$eval('#lbArea table tr', e => e.length) === 10, '仍列出前 10 名');
    ok((await dataKeys(page, 'colorgame_boards/A_30_basic_999/entries/anon')).length === 0, '沒寫入');
    await ctx.close(); }
  { // 3) 這個榜已有更高成績
    const { page, ctx } = await open(browser, { ls: cfgLs({ grid: 2 }), data: seedBoard('A_42_basic_999', [['anon', 'Me', 99999, 10], ['x', 'Zed', 5, 50]]) });
    await H.startStd(page); await correctN(page, 6); await calm(page); await H.loseA(page, 5);
    await page.waitForFunction(() => !document.getElementById('lbArea').innerText.includes('讀取中'));
    ok((await txt(page, '#lbArea')).includes('你在這個榜已有更高的成績') && await page.$('#nick') === null, '已有更高成績 → 「你在這個榜已有更高的成績」，不能上傳');
    ok((await data(page, 'colorgame_boards/A_42_basic_999/entries/anon')).score === 99999, '舊成績沒被蓋掉');
    await ctx.close(); }
  { // 4) 自己的舊成績比較低 → 可以上傳並蓋掉舊的（同一個人只有一筆）
    const { page, ctx } = await open(browser, { ls: cfgLs({ set: 'adv' }), data: seedBoard('A_20_adv_999', [['anon', 'Old', 1, 500], ['x', 'Zed', 5, 50]]) });
    await H.startStd(page); await correctN(page, 6); await calm(page); await H.loseA(page, 5);
    await page.waitForSelector('#nick');
    await page.fill('#nick', 'Newbie'); await page.dispatchEvent('#nick', 'input'); await page.click('#upBtn');
    await page.waitForFunction(() => document.getElementById('lbArea').innerText.includes('已上傳'));
    const e = await data(page, 'colorgame_boards/A_20_adv_999/entries/anon');
    ok(e.name === 'Newbie' && e.score > 1, '進階色榜 A_20_adv_999：比舊成績高 → 蓋掉舊的', e);
    ok((await dataKeys(page, 'colorgame_boards/A_20_adv_999/entries/')).length === 2, '同一人只留一筆（榜上共 2 筆）');
    await ctx.close(); }
  { // 5) 榜上滿 10 筆但分數很低 → 進榜；記住上次暱稱；上傳後榜上只列 10 名，自己排第一
    const { page, ctx } = await open(browser, { ls: Object.assign(cfgLs({ range: 9999 }), { shushu_nick: '小明' }), data: tenOthers('A_20_basic_9999', 1, 'Low') });
    await H.startStd(page); await correctN(page, 6); await calm(page); await H.loseA(page, 5);
    await page.waitForSelector('#nick');
    ok(await page.$eval('#nick', e => e.value) === '小明', '暱稱欄自動帶入上次用的暱稱');
    await page.click('#upBtn');
    await page.waitForFunction(() => document.getElementById('lbArea').innerText.includes('已上傳'));
    const rows = await page.$$eval('#lbArea table tr', rs => rs.map(r => r.className + '|' + r.innerText.replace(/\s+/g, ' ')));
    ok(rows.length === 10 && rows[0].startsWith('me|1 小明'), '上傳後榜上列 10 名，小明排第 1 並標色', rows.slice(0, 2));
    ok(!rows.some(r => r.includes('Low1 ')), '被擠出前 10 的最低分已不在榜上');
    await ctx.close(); }
  { // 6) 讀取／上傳失敗
    const { page, ctx } = await open(browser);
    await H.startStd(page);
    await page.evaluate(() => { window.LB.top = async () => { throw new Error('offline'); }; });
    await correctN(page, 1); await calm(page); await H.loseA(page, 5);
    await page.waitForFunction(() => !document.getElementById('lbArea').innerText.includes('讀取中'));
    ok((await txt(page, '#lbArea')).includes('排行榜暫時無法使用'), '讀榜失敗：顯示「排行榜暫時無法使用」');
    await ctx.close(); }
  { const { page, ctx } = await open(browser);
    await H.startStd(page); await correctN(page, 6); await calm(page);
    await page.evaluate(() => { window.LB.submit = async () => { throw new Error('denied'); }; });
    await H.loseA(page, 5);
    await page.waitForSelector('#nick'); await page.fill('#nick', 'X'); await page.dispatchEvent('#nick', 'input'); await page.click('#upBtn');
    await page.waitForFunction(() => document.getElementById('lbArea').innerText.includes('暫時無法使用'));
    ok((await dataKeys(page, 'colorgame_boards')).length === 0, '上傳失敗：顯示錯誤、沒有寫入');
    await ctx.close(); }
  { // 7) 玩法 B＋進階色＋0–9999＋6×5：排行榜分組是 B_30_adv_9999
    const { page, ctx, errors } = await open(browser, { ls: cfgLs({ mode: 'B', grid: 1, set: 'adv', range: 9999 }) });
    await H.startStd(page);
    for(let i = 0; i < 4; i++){ const q = await page.evaluate(() => S.qid); await H.answerB(page); await H.waitQ(page, q); }
    await page.waitForTimeout(450);
    for(let i = 0; i < 5; i++){ await H.wrongB(page); await page.waitForTimeout(40); }
    await page.waitForSelector('#over:not(.hide)');
    await page.waitForSelector('#nick');
    ok((await txt(page, '#lbArea')).includes('進榜了'), 'B 玩到結束且有分數 → 可上傳');
    await page.fill('#nick', 'BB'); await page.dispatchEvent('#nick', 'input'); await page.click('#upBtn');
    await page.waitForFunction(() => document.getElementById('lbArea').innerText.includes('已上傳'));
    ok((await dataKeys(page, 'colorgame_boards/')).join() === 'colorgame_boards/B_30_adv_9999/entries/anon', '榜單代號 = 玩法_格數_顏色組_範圍 → B_30_adv_9999', await dataKeys(page, 'colorgame_boards/'));
    const plays = await page.evaluate(() => Object.entries(window.__DATA).filter(([k]) => k.startsWith('plays/')).map(([, v]) => v.level));
    ok(plays[0] === 'std:B_6x5', '遊玩紀錄的關卡名 std:B_6x5', plays);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { // 8) 主選單的 🏆：依目前選的玩法／格數／顏色組／範圍顯示該榜，由高到低
    const seed = Object.assign({}, seedBoard('A_30_basic_999', [['a', '最高', 900, 40], ['b', '次高', 500, 65], ['c', '第三', 500, 90]]));
    const { page, ctx } = await open(browser, { ls: cfgLs({ grid: 1 }), data: seed });
    await page.click('#app .big.sec:not(a)');
    await page.waitForFunction(() => !document.getElementById('lbBody').innerText.includes('讀取中'));
    ok(await txt(page, '#lbov .sub') === '玩法 A · 6×5 · 基本色（9） · 0–999', '榜單標題寫出目前的玩法／格數／顏色／範圍', await txt(page, '#lbov .sub'));
    const rows = await page.$$eval('#lbBody table tr', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')));
    ok(JSON.stringify(rows) === JSON.stringify(['1 最高 900 0:40', '2 次高 500 1:05', '3 第三 500 1:30']), '依分數高→低，同分時用時短的在前；顯示分數與用時', rows);
    await page.click('#lbov .big'); 
    ok(await H.hidden(page, '#lbov'), '按關閉 → 榜單關掉');
    await H.clickOpt(page, '5×4');
    await page.click('#app .big.sec:not(a)');
    await page.waitForFunction(() => !document.getElementById('lbBody').innerText.includes('讀取中'));
    ok((await txt(page, '#lbBody')) === '還沒有成績 Aún no hay puntajes' && (await txt(page, '#lbov .sub')).includes('5×4'), '換成 5×4 → 這個榜沒有資料（還沒有成績）', await txt(page, '#lbBody'));
    await ctx.close(); }

  console.log('\n[T] 舊式 ?t= 連結');
  const T1 = '?t=' + H.b64url({ name: '週三練習', mode: 'B', rows: 99, cols: 99, hearts: 7, ids: ['red', 'blue', 'green'] });
  { const { page, ctx, errors } = await open(browser, { qs: T1 });
    await page.waitForFunction(() => screen === 'link');
    const sum = await txt(page, '#app .panel');
    ok(sum.includes('週三練習') && sum.includes('8×6') && sum.includes('♥5'), '列欄超出範圍被限制成 8×6；愛心不合法(7)改回 5', sum);
    ok(sum.includes('聽顏色'), '玩法 B 顯示在摘要');
    await page.fill('#app input.txt', 'Ana');
    await H.clickOpt(page, '開');
    await H.startStd(page);
    ok(await page.$$eval('#board .cell', e => e.length) === 48, '連結玩法：8×6 = 48 格');
    const cols = new Set((await H.cellsInfo(page)).map(c => c.rgb));
    ok(cols.size === 3 && [...cols].every(c => [H.RGB_OF_SHORT['紅'], H.RGB_OF_SHORT['藍'], H.RGB_OF_SHORT['綠']].includes(c)), '盤面只有紅、藍、綠三色');
    ok(await page.$$eval('#keys .key', e => e.length) === 16, '玩法 B：有數字鍵');
    ok((await page.$eval('#qtext .zh', e => e.textContent)) === await H.lastSpoken(page), '在連結開始畫面打開「顯示題目文字」→ 遊戲中看得到題目');
    ok(await H.hudHearts(page) === '♥♥♥♥♥', '5 顆愛心');
    const r = await H.answerB(page);
    ok(r.known && r.n !== null, '連結的 B 也能正常作答', r);
    await page.waitForTimeout(450);
    for(let i = 0; i < 5; i++){ await H.waitQ(page, 0).catch(() => {}); await page.waitForFunction(() => !S.busy); await H.wrongB(page); await page.waitForTimeout(40); }
    await page.waitForSelector('#over:not(.hide)');
    ok(await page.$('#lbArea') === null && (await txt(page, '#over')).includes('不會上傳排行榜'), '舊式連結不上傳排行榜，提示自行記錄');
    ok(await page.$eval('#stuNote', e => e.value) === 'Ana', '成績圖片的姓名欄預填「Ana」');
    ok((await dataKeys(page, 'colorgame_boards')).length === 0 && (await dataKeys(page, 'class_scores')).length === 0, '沒有寫任何成績到資料庫');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#over button', { hasText: '下載成績圖片' }).click()]);
    const buf = await require('fs').promises.readFile(await dl.path());
    ok(dl.suggestedFilename() === 'pop-colores-score.png' && buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a' && buf.length > 3000, '下載成績圖片：pop-colores-score.png，是真的 PNG', [dl.suggestedFilename(), buf.length]);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { qs: '?t=' + H.b64url({ mode: 'A', rows: 1, cols: 1, ids: ['red', 'blue'] }) });
    await page.waitForFunction(() => screen === 'link');
    const sum = await txt(page, '#app .panel .note');
    ok(sum.includes('3×3') && sum.includes('♥5'), '列欄太小被補到最小 3×3；沒寫愛心 → 預設 5', sum);
    await ctx.close(); }
  for(const [label, t] of [['亂碼', '!!!not-base64'], ['含自訂顏色（進階功能只能走 ID 連結）', H.b64url({ mode: 'A', rows: 3, cols: 3, ids: ['red'], custom: [{ n: '天空藍', h: '#7fd1ff' }] })], ['只有 1 種顏色', H.b64url({ mode: 'A', rows: 3, cols: 3, ids: ['red'] })], ['含自訂數字清單', H.b64url({ mode: 'A', rows: 3, cols: 3, ids: ['red', 'blue'], nums: [1, 2, 3] })]]){
    const { page, ctx } = await open(browser, { qs: '?t=' + t });
    ok((await txt(page, '#app')).includes('這個連結已失效') && await page.$('#board') === null && await page.$('input.txt') === null, '無效連結（' + label + '）→ 「連結已失效」，不能玩', await txt(page, '#app'));
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { qs: L3, maint: true });
    ok((await txt(page, '#app')).includes('維修中') && await page.$('input.txt') === null, '維修中：?t= 連結也不能玩');
    await ctx.close(); }
  { // ?t= ＋ ?class=：成績回傳，設定碼記成 link
    const { page, ctx, errors } = await open(browser, { qs: L3 + '&class=' + H.CID });
    await page.waitForFunction(() => screen === 'link');
    ok((await txt(page, '#app')).includes('週三班'), '班級名稱「週三班」顯示在開始畫面');
    await page.click('#app .big');
    ok((await txt(page, '#toast')).includes('請先輸入暱稱') && await page.$('#board') === null, '沒填暱稱按開始 → 提醒，不開局', await txt(page, '#toast'));
    await page.fill('#app input.txt', 'Leo'); await page.dispatchEvent('#app input.txt', 'input');
    await H.startStd(page);
    await correctN(page, 2); await calm(page);
    await H.loseA(page, 3);
    await page.waitForFunction(() => document.getElementById('classArea').innerText.includes('已回傳'));
    const keys = await dataKeys(page, 'class_scores/' + H.CID + '_colores_link_');
    ok(keys.length === 1, '成績寫進 class_scores，設定碼 = link', keys);
    const rec = await data(page, keys[0]);
    ok(rec.nick === 'Leo' && rec.k === 'link' && rec.game === 'colores' && rec.best === Number(await txt(page, '#over .total')) && rec.extra.cleared === 0, '紀錄：暱稱、最高分 = 結算總分、未清盤', rec);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  await browser.close();
  const c = H.counts();
  console.log('\n通過 ' + c.pass + '，失敗 ' + c.fail);
  process.exit(c.fail ? 1 : 0);
})();
