// 開始畫面的選項：格數（6×5、7×6）、顏色組（進階色）、數字範圍（0–9999）、顯示題目文字
// 每個選項都是「按畫面上的選項 → 開始 → 檢查真的玩到的盤面／語音」。用法：node tests/run.js
const H = require('./helpers');
const { ok, open, txt } = H;

const settingsJson = page => page.evaluate(() => JSON.parse(localStorage.getItem('shushu_cfg')));

(async () => {
  const browser = await H.chromium.launch();

  console.log('\n[S1] 格數：預設 5×4、改 6×5、改 7×6');
  { const { page, ctx, errors } = await open(browser);
    ok(await H.isOn(page, '5×4'), '預設選中 5×4');
    await H.startStd(page);
    ok(await page.$$eval('#board .cell', e => e.length) === 20, '5×4 → 20 格');
    ok((await page.$eval('#board', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 4, '5×4：畫面上 4 欄');
    ok(await page.$$eval('#board .cell', es => new Set(es.map(e => e.offsetTop)).size) === 5, '5×4：畫面上 5 列');
    await page.click('#ctl button:nth-child(3)'); await page.click('#cYes');   // ⌂ 主選單
    ok(await H.isOn(page, '5×4'), '回主選單');
    await H.clickOpt(page, '6×5');
    ok(await H.isOn(page, '6×5') && !(await H.isOn(page, '5×4')), '按 6×5 → 選中');
    ok((await settingsJson(page)).grid === 1, '格數 6×5 記進 shushu_cfg');
    await H.startStd(page);
    ok(await page.$$eval('#board .cell', e => e.length) === 30, '6×5 → 30 格');
    ok((await page.$eval('#board', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 5, '6×5：畫面上 5 欄');
    ok(await page.$$eval('#board .cell', es => new Set(es.map(e => e.offsetTop)).size) === 6, '6×5：畫面上 6 列');
    ok(await page.evaluate(() => S.rows === 6 && S.cols === 5), '遊戲內部列＝6、欄＝5');
    const r = await H.answerA(page);
    ok(r.match, '6×5：語音唸的數字和被問的方塊一致', r);
    await page.waitForTimeout(450);
    ok((await H.cellsInfo(page)).filter(c => c.alive).length === 29, '6×5：答對消掉一格（剩 29）');
    await page.waitForFunction(() => !S.busy);   // 答對後 650ms 才出下一題；太早離開會觸發遊戲的一個小問題（見回報）
    await page.click('#ctl button:nth-child(3)'); await page.click('#cYes');
    await H.clickOpt(page, '7×6');
    ok((await settingsJson(page)).grid === 2, '格數 7×6 記進 shushu_cfg');
    await H.startStd(page);
    ok(await page.$$eval('#board .cell', e => e.length) === 42, '7×6 → 42 格');
    ok((await page.$eval('#board', e => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 6, '7×6：畫面上 6 欄');
    ok(await page.$$eval('#board .cell', es => new Set(es.map(e => e.offsetTop)).size) === 7, '7×6：畫面上 7 列');
    const nums = (await H.cellsInfo(page)).map(c => c.n);
    ok(nums.filter(n => n < 10).length === 4 && nums.filter(n => n >= 10 && n < 100).length === 13 && nums.filter(n => n >= 100).length === 25, '7×6 數字依位數分配（個位 4／兩位 13／三位 25；42×10%、30%、60% 取整後多的 1 格給兩位數）', nums);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '7×6 手機寬度沒有橫向捲動');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await page.reload(); await page.waitForTimeout(300);
    ok(await H.isOn(page, '7×6'), '重新整理後記得 7×6');
    await ctx.close(); }
  { // 玩法 B 在大盤面也能清除：6×5 的 B 玩幾題
    const { page, ctx } = await open(browser, { ls: { shushu_cfg: JSON.stringify({ mode: 'B', grid: 1 }) } });
    await H.startStd(page);
    ok(await page.$$eval('#board .cell', e => e.length) === 30, 'B＋6×5：30 格');
    const rs = [];
    for(let i = 0; i < 3; i++){ const q = await page.evaluate(() => S.qid); rs.push(await H.answerB(page)); await H.waitQ(page, q); }
    await page.waitForTimeout(450);
    ok(rs.every(x => x.known && x.n !== null) && (await H.cellsInfo(page)).filter(c => c.alive).length === 27, 'B＋6×5：連答 3 題 → 剩 27 格', rs);
    await ctx.close(); }

  console.log('\n[S2] 顏色組：基本色（9）vs 進階色（14）');
  { const { page, ctx, errors } = await open(browser);
    ok(await H.isOn(page, '基本色'), '預設選中基本色');
    await H.startStd(page);
    ok(await page.$$eval('.cbtn', e => e.length) === 9, '基本色：9 顆顏色按鈕');
    const labels = await page.$$eval('.cbtn .zh', e => e.map(x => x.textContent));
    ok(labels.join(',') === '紅,黃,藍,綠,黑,白,灰,橘,紫', '基本色按鈕文字與順序', labels);
    ok(await page.$$eval('#colorBtns', e => e[0].style.gridTemplateColumns) === 'repeat(3, 1fr)', '基本色 9 顆排 3 欄');
    await page.click('#ctl button:nth-child(3)'); await page.click('#cYes');
    await H.clickOpt(page, '進階色');
    ok(await H.isOn(page, '進階色') && (await settingsJson(page)).set === 'adv', '按進階色 → 選中並記下');
    await H.startStd(page);
    const btn = await page.$$eval('.cbtn .zh', e => e.map(x => x.textContent));
    ok(btn.join(',') === H.ADV.join(','), '進階色：14 顆按鈕（紅黃橘紫黑白粉紅咖啡深灰淺灰深藍淺藍深綠淺綠）', btn);
    ok(await page.$$eval('#colorBtns', e => e[0].style.gridTemplateColumns) === 'repeat(4, 1fr)', '進階色 14 顆排 4 欄');
    const bgs = await page.$$eval('.cbtn', es => es.map(e => getComputedStyle(e).backgroundColor));
    ok(new Set(bgs).size === 14, '14 顆按鈕顏色兩兩不同');
    ok(JSON.stringify(bgs) === JSON.stringify(H.ADV.map(n => H.RGB_OF_SHORT[n])), '每顆按鈕的底色和顏色名稱相符', bgs);
    ok(await page.$eval('.cbtn:nth-child(9)', e => e.innerText.replace(/\s+/g, ' ')) === 'shēn huī 深灰 gris oscuro', '「深灰」按鈕：拼音＋中文＋西文');
    ok(await page.$$eval('.cbtn', es => es.find(e => e.textContent.includes('深藍')).innerText.replace(/\s+/g, ' ')) === 'shēn lán 深藍 azul oscuro', '「深藍」按鈕：拼音＋中文＋西文');
    const cells = await H.cellsInfo(page);
    const colorsOnBoard = new Set(cells.map(c => c.rgb));
    ok(colorsOnBoard.size === 14 && H.ADV.every(n => colorsOnBoard.has(H.RGB_OF_SHORT[n])), '進階色：盤面 14 種顏色全部出現（20 格）');
    ok(![...colorsOnBoard].some(c => c === H.RGB_OF_SHORT['綠'] || c === H.RGB_OF_SHORT['藍'] || c === H.RGB_OF_SHORT['灰']), '進階色組沒有「綠」「藍」「灰」這三個基本色');
    // 進階色作答：連答 4 題，語音唸的都是進階色名稱
    const spoken = [];
    for(let i = 0; i < 4; i++){ const q = await page.evaluate(() => S.qid); const r = await H.answerA(page); spoken.push(r); await H.waitQ(page, q); }
    ok(spoken.every(x => x.match), '進階色 A：連答 4 題，語音數字都對得上方塊', spoken);
    ok(await H.hudScore(page) > 0 && await H.hudHearts(page) === '♥♥♥♥♥', '連續答對 → 有分數、愛心沒少');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { // 進階色＋玩法 B：唸出來的是進階色名稱（粉紅色、深藍色…）
    const { page, ctx } = await open(browser, { ls: { shushu_cfg: JSON.stringify({ mode: 'B', set: 'adv' }) } });
    await H.startStd(page);
    const seen = new Set();
    for(let i = 0; i < 6; i++){ const q = await page.evaluate(() => S.qid); const r = await H.answerB(page); seen.add(r.spoken); ok(r.known && r.n !== null, 'B＋進階色 第 ' + (i + 1) + ' 題：' + r.spoken + ' 找得到方塊並答對'); await H.waitQ(page, q); }
    ok([...seen].every(s => H.ADV.map(n => n + '色').includes(s)), '語音都是進階色組的名稱', [...seen]);
    await ctx.close(); }

  console.log('\n[S3] 數字範圍：0–999 vs 0–9999');
  { const { page, ctx } = await open(browser);
    ok(await H.isOn(page, '0 – 999'), '預設 0–999');
    await H.startStd(page);
    let nums = (await H.cellsInfo(page)).map(c => c.n);
    ok(Math.max(...nums) <= 999 && nums.filter(n => n < 10).length === 2 && nums.filter(n => n >= 10 && n < 100).length === 6 && nums.filter(n => n >= 100).length === 12, '0–999：個位 2／兩位 6／三位 12，沒有千位數', nums);
    await page.click('#ctl button:nth-child(3)'); await page.click('#cYes');
    await H.clickOpt(page, '0 – 9999');
    ok((await settingsJson(page)).range === 9999 && await H.isOn(page, '0 – 9999'), '按 0–9999 → 選中並記下');
    await H.startStd(page);
    nums = (await H.cellsInfo(page)).map(c => c.n);
    ok(nums.filter(n => n < 10).length === 2 && nums.filter(n => n >= 10 && n < 100).length === 4 && nums.filter(n => n >= 100 && n < 1000).length === 6 && nums.filter(n => n >= 1000).length === 8, '0–9999：個位 2／兩位 4／三位 6／四位 8', nums);
    ok(Math.max(...nums) <= 9999 && Math.min(...nums) >= 0, '數字都在 0–9999');
    // 連答，直到遇到四位數題目；確認語音唸出「千」且與方塊一致
    let sawFour = null; const results = [];
    for(let i = 0; i < 20 && !sawFour; i++){
      const q = await page.evaluate(() => S.qid);
      const r = await H.answerA(page); results.push(r);
      if(r.n >= 1000) sawFour = r;
      await H.waitQ(page, q);
    }
    ok(results.every(x => x.match), '0–9999：每題語音數字都對得上方塊', results.filter(x => !x.match));
    ok(sawFour && sawFour.spoken.includes('千') && sawFour.match, '遇到四位數 ' + (sawFour && sawFour.n) + ' → 唸「' + (sawFour && sawFour.spoken) + '」', sawFour);
    await ctx.close(); }
  { // 玩法 B 的四位數：按 千／百／十 鍵
    const { page, ctx } = await open(browser);
    await page.evaluate(() => startGame({ mode: 'B', rows: 3, cols: 3, colors: [COLORS.red, COLORS.blue], nums: [3005], range: 9999, hearts: 5, title: '' }, 'std'));
    await H.waitQ(page, 0);
    await H.typeB(page, '三千零五'); await page.click('.key.ok');
    await page.waitForTimeout(450);
    ok((await H.cellsInfo(page)).filter(c => c.alive).length === 8 && await H.hudHearts(page) === '♥♥♥♥♥', 'B：3005 按「三千零五」答對');
    await ctx.close(); }

  console.log('\n[S4] 顯示題目文字（關／開）');
  { const { page, ctx } = await open(browser);
    ok(await H.isOn(page, '關'), '預設是「關」');
    await H.startStd(page);
    ok(await page.$eval('#qtext', e => e.innerHTML) === '', 'A：關 → 題目區是空的');
    await page.click('#ctl button:nth-child(3)'); await page.click('#cYes');
    await H.clickOpt(page, '開');
    ok(await H.isOn(page, '開') && (await settingsJson(page)).showText === true, '按「開」→ 選中並記下');
    await H.startStd(page);
    const sp = await H.lastSpoken(page);
    ok(await page.$eval('#qtext .zh', e => e.textContent) === sp, 'A：開 → 題目文字 = 語音唸的數字', [sp, await txt(page, '#qtext')]);
    ok((await page.$eval('#qtext .ph', e => e.textContent)).length > 0, 'A：題目文字上面有拼音');
    const target = (await H.cellsInfo(page))[await page.evaluate(() => S.cur)];
    ok(H.parseCN(await page.$eval('#qtext .zh', e => e.textContent)) === target.n, '題目文字的數字就是被問方塊上的數字', [target.n]);
    await page.click('#ctl button:nth-child(3)'); await page.click('#cYes');
    await H.clickOpt(page, '聽顏色');
    await H.startStd(page);
    const sp2 = await H.lastSpoken(page);
    ok(await page.$eval('#qtext .zh', e => e.textContent) === sp2 && /色$/.test(sp2), 'B：開 → 題目文字 = 語音唸的顏色（' + sp2 + '）');
    ok(await page.$eval('#qtext .ph', e => e.textContent).then(t => t.split(' ').length === 2), 'B：顏色兩個字的拼音（例：hóng sè）');
    // 答完下一題，題目文字跟著換
    const q = await page.evaluate(() => S.qid); await H.answerB(page); await H.waitQ(page, q);
    ok(await page.$eval('#qtext .zh', e => e.textContent) === await H.lastSpoken(page), '下一題題目文字更新');
    await page.click('#ctl button:nth-child(3)'); await page.click('#cYes');
    await H.clickOpt(page, '關');
    await H.startStd(page);
    ok(await page.$eval('#qtext', e => e.innerHTML) === '', 'B：改回「關」→ 題目區又是空的');
    await ctx.close(); }
  { // 關掉題目文字時，換拼音設定也不會冒出題目
    const { page, ctx } = await open(browser);
    await H.startStd(page);
    await page.click('#hud .gear'); await page.click('#setov [onclick="setS(\'phon\',\'zhuyin\')"]'); await page.click('#setov .big');
    ok(await page.$eval('#qtext', e => e.innerHTML) === '', '關：改成注音後題目區仍是空的');
    await ctx.close(); }

  await browser.close();
  const c = H.counts();
  console.log('\n通過 ' + c.pass + '，失敗 ' + c.fail);
  process.exit(c.fail ? 1 : 0);
})();
