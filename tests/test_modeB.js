// 玩法 B（聽顏色，輸入數字）完整流程：選玩法 → 聽題 → 按數字鍵 → 退格 → 確認 → 答錯／答對 → 清完整盤 → 結算 → 上傳排行榜
// 另外：短說法（一百一）、簡體顯示。用法：node tests/run.js
const H = require('./helpers');
const { ok, open, txt } = H;

(async () => {
  const browser = await H.chromium.launch();

  console.log('\n[B1] 選玩法 B → 畫面長相');
  const { page, ctx, errors } = await open(browser);
  ok(await H.isOn(page, '聽數字'), '預設是玩法 A（聽數字，選顏色）');
  await H.clickOpt(page, '聽顏色');
  ok(await H.isOn(page, '聽顏色') && !(await H.isOn(page, '聽數字')), '按「聽顏色，輸入數字」→ 變成選中');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('shushu_cfg')).mode) === 'B', '玩法 B 記進 shushu_cfg');
  await H.startStd(page);
  ok(!(await page.$('#colorBtns')), 'B：沒有顏色按鈕');
  ok(await page.$$eval('#keys .key', e => e.length) === 14 + 2, 'B：14 個數字鍵＋退格＋確認');
  const keyTxt = await page.$$eval('#keys .key .zh', e => e.map(x => x.textContent));
  ok(keyTxt.join('') === '零一二兩三四五六七八九十百千', '數字鍵順序：零一二兩三四五六七八九十百千', keyTxt);
  ok(await page.$$eval('#board .cell', e => e.length) === 20, '盤面 20 格（預設 5×4）');
  ok(await H.hudHearts(page) === '♥♥♥♥♥', '一開始 5 顆愛心');
  const sp1 = await H.lastSpoken(page);
  ok(/色$/.test(sp1) && sp1 in H.RGB_OF_NAME, 'B：語音唸的是基本色名稱（○色）', sp1);
  ok((await page.evaluate(() => window.__rates.pop())) === 0.65, '語速用共用設定（正常 0.65）');
  ok(await page.$eval('#qtext', e => e.innerHTML) === '', '預設不顯示題目文字');
  const aliveColors = new Set((await H.cellsInfo(page)).map(c => c.rgb));
  ok(H.BASIC.every(n => aliveColors.has(H.RGB_OF_SHORT[n])), '盤面上 9 種基本色都有出現');

  console.log('\n[B2] 數字鍵、退格、確認');
  await H.typeB(page, '一二');
  ok(await txt(page, '#inbox') === '一二', '按「一」「二」→ 輸入框顯示 一二', await txt(page, '#inbox'));
  await page.click('.key.fn');
  ok(await txt(page, '#inbox') === '一', '退格 → 剩 一');
  await page.click('.key.fn'); await page.click('.key.fn');
  ok(await txt(page, '#inbox') === '', '退到空了再退，不出錯');
  await page.click('.key.ok');
  ok(await H.hudHearts(page) === '♥♥♥♥♥' && await H.hudScore(page) === 0, '輸入框是空的按確認：不算答錯、不扣愛心');
  for(let i = 0; i < 12; i++) await page.click('.key:nth-child(12)');   // 「十」
  ok((await txt(page, '#inbox')).length === 10, '最多輸入 10 個字', await txt(page, '#inbox'));
  for(let i = 0; i < 10; i++) await page.click('.key.fn');

  console.log('\n[B3] 答錯：數字對但顏色不對、完全沒有的數字');
  let qid = await page.evaluate(() => S.qid);
  const sp = await H.lastSpoken(page);
  let cells = await H.cellsInfo(page);
  const other = cells.find(c => c.alive && c.rgb !== H.RGB_OF_NAME[sp]);
  await H.typeB(page, H.toCN(other.n)); await page.click('.key.ok');
  ok(await H.hudHearts(page) === '♥♥♥♥♡', '數字存在但是別的顏色 → 算錯，剩 4 顆', await H.hudHearts(page));
  ok(await txt(page, '#inbox') === '', '答錯後輸入框清空');
  ok(await page.$eval('#boardWrap', e => e.classList.contains('shake')) || await page.$eval('#inbox', e => e.classList.contains('shake')), '答錯有抖動');
  ok(await txt(page, '#toast') === '−5', '答錯跳 −5', await txt(page, '#toast'));
  ok((await H.cellsInfo(page)).filter(c => c.alive).length === 20, '答錯方塊不會消失');
  const n0 = await H.wrongB(page);
  ok(await H.hudHearts(page) === '♥♥♥♡♡', '輸入盤面上沒有的數字 ' + n0 + ' → 再扣一顆');
  ok(await H.hudScore(page) === 0, '分數沒有可扣時停在 0（不會變負）');

  console.log('\n[B4] 答對：算分、方塊消失、下一題');
  qid = await page.evaluate(() => S.qid);
  let r = await H.answerB(page);
  const digits = String(r.n).length, base = [0, 10, 15, 20, 30][digits];
  const sc = await H.hudScore(page);
  ok(r.known && r.n !== null, '聽到的顏色在盤面上找得到對應方塊', r);
  ok(sc >= base && sc <= base + 10 && sc % 5 === 0, '答對得分 = ' + digits + ' 位數基本分 ' + base + ' ＋ 速度加成（0／5／10）', sc);
  await page.waitForTimeout(450);
  ok((await H.cellsInfo(page)).filter(c => c.alive).length === 19, '答對的方塊消失（剩 19 格）');
  ok((await txt(page, '#toast')).startsWith('+' + sc), '答對跳出 +分數', await txt(page, '#toast'));
  ok(await H.hudHearts(page) === '♥♥♥♡♡', '答對不動愛心');
  await H.waitQ(page, qid);
  ok(await page.evaluate(q => S.qid > q, qid), '過一下自動出下一題');

  console.log('\n[B5] 清完整盤（真的按鍵作答）→ 結算');
  const rs = await H.clearBoard(page, 'B');
  ok(rs.length === 19 && rs.every(x => x.known && x.n !== null), '剩下 19 題每題的顏色都認得、都找得到方塊', rs.filter(x => !x.known || x.n === null));
  await page.waitForSelector('#over:not(.hide)');
  ok((await txt(page, '#over h1')) === '全部清除！ ¡Tablero limpio!', '結算標題：全部清除', await txt(page, '#over h1'));
  const total = Number(await txt(page, '#over .total'));
  ok(total > 0, '總分是正數', total);
  const tbl = await txt(page, '#over table');
  ok(tbl.includes('清盤獎勵') && tbl.includes('+50'), '清盤獎勵 +50', tbl);
  ok(tbl.includes('愛心獎勵') && tbl.includes('+60'), '愛心獎勵 = 3 顆 × 20 = +60', tbl);
  ok(await page.$eval('#commentLine', e => e.innerText).then(t => t.includes('全部清完，太厲害了')), '全清但愛心有少 → 評語「太厲害了」（不是完美）');
  ok(total === await page.evaluate(() => S.score) && total >= 110, '總分 = 遊戲內分數，且至少含兩項獎勵 110', total);
  const plays = await page.evaluate(() => Object.entries(window.__DATA).filter(([k]) => k.startsWith('plays/')).map(([, v]) => v));
  ok(plays.length === 1 && plays[0].level === 'std:B_5x4' && plays[0].done === true && plays[0].score === total, '遊玩紀錄：關卡 std:B_5x4、已完成、分數相同', plays);

  console.log('\n[B6] 結算後上傳排行榜（B 榜）');
  await page.waitForSelector('#lbArea #nick');
  await page.fill('#nick', '小B'); await page.dispatchEvent('#nick', 'input');
  await page.click('#upBtn');
  await page.waitForFunction(() => document.getElementById('lbArea').innerText.includes('已上傳'));
  const ent = await page.evaluate(() => window.__DATA['colorgame_boards/B_20_basic_999/entries/anon']);
  ok(ent && ent.name === '小B' && ent.score === total && ent.hearts === 3 && ent.cleared === true, 'B 榜 B_20_basic_999 寫入：暱稱、分數、愛心 3、已清盤', ent);
  ok(ent && ent.rank === ent.score * 100000 + (99999 - ent.secs), '排名值 = 分數×100000 +（99999−秒數）', ent);
  ok(await page.$eval('#lbArea tr.me', e => e.innerText.includes('小B')), '榜上自己那一列標出來');
  // 再玩一次 → 回到 B 的新一局
  await page.click('#over .big:not(.sec)');
  await H.waitQ(page, 0);
  ok(await page.evaluate(() => S.mode === 'B' && S.score === 0 && S.hearts === 5 && S.cells.every(c => c.alive)), '「再玩一次」：還是玩法 B、分數歸零、愛心回 5、盤面重來');
  ok(errors.length === 0, '沒有程式錯誤', errors);
  await ctx.close();

  console.log('\n[B7] 玩法 B 的唸法：短說法、簡體顯示');
  { const { page, ctx, errors } = await open(browser);
    // 老師連結式的 nums 清單走 startGame（和學生連結同一個函式）：全部方塊都是 110
    await page.evaluate(() => startGame({ mode: 'B', rows: 3, cols: 3, colors: [COLORS.red, COLORS.blue], nums: [110], range: 999, hearts: 5, title: '' }, 'std'));
    await H.waitQ(page, 0);
    const want = await H.lastSpoken(page);
    const cells = (await H.cellsInfo(page)).filter(c => c.alive && c.rgb === H.RGB_OF_NAME[want]);
    ok(cells.length > 0, '110 的方塊找得到（顏色 ' + want + '）');
    await H.typeB(page, '一百一'); await page.click('.key.ok');
    ok(await page.$$eval('#board .cell.empty,#board .cell.pop', e => e.length) === 1 && await H.hudHearts(page) === '♥♥♥♥♥', '「一百一」可當 110 的答案（短說法）');
    await H.waitQ(page, 1);
    await H.typeB(page, '一百十'); await page.click('.key.ok');
    ok(await H.hudHearts(page) === '♥♥♥♥♡', '「一百十」不是 110 → 算錯', await H.hudHearts(page));
    await H.typeB(page, '一百一十'); await page.click('.key.ok');
    await page.waitForTimeout(450);
    ok((await H.cellsInfo(page)).filter(c => c.alive).length === 7, '標準說法「一百一十」答對（又少一格）');
    ok(errors.length === 0, '沒有程式錯誤', errors); await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { 'hanziGames.settings': JSON.stringify({ v: 1, script: 'simp', lang: 'es', phon: 'pinyin', rate: 'normal' }), shushu_cfg: JSON.stringify({ mode: 'B', showText: true }) } });
    await H.startStd(page);
    const spoken = await H.lastSpoken(page);
    ok(await page.$eval('#qtext .zh', e => e.textContent) === spoken.replace('紅', '红').replace('藍', '蓝').replace('綠', '绿').replace('黃', '黄'), '簡體：題目文字顯示簡體，語音仍唸繁體字', [spoken, await page.$eval('#qtext .zh', e => e.textContent)]);
    ok(await page.$$eval('#keys .key .zh', e => e.map(x => x.textContent)).then(a => a.includes('两') && !a.includes('兩')), '簡體：數字鍵「兩」變「两」');
    await page.click('.key:nth-child(4)');
    ok(await txt(page, '#inbox') === '两', '簡體：輸入框顯示「两」');
    await ctx.close(); }

  await browser.close();
  const c = H.counts();
  console.log('\n通過 ' + c.pass + '，失敗 ' + c.fail);
  process.exit(c.fail ? 1 : 0);
})();
