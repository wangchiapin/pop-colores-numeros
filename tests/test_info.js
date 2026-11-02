// ⓘ 說明視窗＋設定視窗不被切掉：按「i」開、完成／點外面關；語言／字形跟著設定；設定視窗在小螢幕內可捲動、版權列隱藏。用法：node tests/run.js
const H = require('./helpers');
const { ok, open } = H;

(async () => {
  const browser = await H.chromium.launch();
  const visible = (page, sel) => page.$eval(sel, e => !e.classList.contains('hide'));
  const txt = (page, sel) => page.$eval(sel, e => e.innerText);

  console.log('\n[I1] 首頁有 i 按鈕，點開說明、按完成關閉');
  { const { page, ctx, errors } = await open(browser, { viewport: { width: 390, height: 640 } });
    ok(await page.$('#app .infob') !== null, '首頁有 i 按鈕');
    ok(await page.$eval('.infob', e => e.getBoundingClientRect().right < document.querySelector('#app .gear').getBoundingClientRect().left), 'i 在 ⚙ 的左邊');
    await page.click('.infob');
    ok(await visible(page, '#infoov'), '點 i → 說明視窗打開');
    const t = await txt(page, '#infoov');
    ok(/說明/.test(t) && /怎麼玩/.test(t) && /兩種玩法/.test(t), '有標題、怎麼玩、兩種玩法', t.slice(0, 40));
    ok(/聽數字，選顏色/.test(t) && /聽顏色，輸入數字/.test(t), '兩種玩法的名字都在');
    ok(/Cómo jugar/.test(t), '預設中＋西：有西文小字');
    ok(await page.$$eval('#infoov li', e => e.length) === 5, '怎麼玩有 5 步');
    ok(await page.$eval('#infoov .big', e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight; }) || await page.$eval('#infoov .card', e => e.scrollHeight > e.clientHeight), '完成鈕看得到或可捲到');
    ok(await page.$eval('#hgCopy', e => getComputedStyle(e).display) === 'none', '說明打開時版權列隱藏');
    await page.click('#infoov .big');
    ok(!(await visible(page, '#infoov')), '按完成 → 關閉');
    ok(await page.$eval('#hgCopy', e => getComputedStyle(e).display) !== 'none', '關閉後版權列回來');
    await page.click('.infob'); await page.mouse.click(5, 5);
    ok(!(await visible(page, '#infoov')), '點視窗外面 → 關閉');
    ok(errors.length === 0, '沒有網頁錯誤', errors);
    await ctx.close(); }

  console.log('\n[I2] 說明跟著設定：只有中文／簡體／英文');
  { const { page, ctx } = await open(browser);
    await page.click('#app .gear'); await page.click('#setov [onclick="setS(\'lang\',\'zh\')"]'); await page.click('#setov .big');
    await page.click('.infob'); let t = await txt(page, '#infoov');
    ok(/怎麼玩/.test(t) && !/Cómo jugar|How to play/.test(t), '只有中文：沒有外語小字');
    await page.click('#infoov .big');
    await page.click('#app .gear'); await page.click('#setov [onclick="setS(\'lang\',\'en\')"]'); await page.click('#setov [onclick="setS(\'script\',\'simp\')"]'); await page.click('#setov .big');
    await page.click('.infob'); t = await txt(page, '#infoov');
    ok(/怎么玩/.test(t) && /How to play/.test(t) && !/怎麼玩/.test(t), '簡體＋英文');
    await ctx.close(); }

  console.log('\n[I3] 設定視窗在小螢幕：不超出畫面、內容可捲、版權列隱藏、完成鈕按得到');
  { const { page, ctx } = await open(browser, { viewport: { width: 390, height: 560 } });
    await page.click('#app .gear');
    const r = await page.$eval('#setov .setcard', e => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight, sc: e.scrollHeight > e.clientHeight }; });
    ok(r.top >= 0 && r.bottom <= r.vh, '設定卡片在畫面內', r);
    ok(r.sc, '內容比卡片高 → 卡片可以捲動');
    ok(await page.$eval('#hgCopy', e => getComputedStyle(e).display) === 'none', '設定打開時版權列隱藏');
    await page.$eval('#setov .setcard', e => { e.scrollTop = e.scrollHeight; });
    ok(await page.$eval('#setov .big', e => { const b = e.getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; }), '捲到底後完成鈕完整看得到');
    await page.click('#setov .big');
    ok(!(await visible(page, '#setov')), '按完成關閉');
    ok(await page.$eval('#hgCopy', e => getComputedStyle(e).display) !== 'none', '版權列回來');
    await ctx.close(); }

  console.log('\n[I4] 遊戲中沒有 i 按鈕（只有首頁有），設定照常');
  { const { page, ctx } = await open(browser);
    await H.startStd(page);
    ok(await page.$('#hud .infob') === null, '遊戲中沒有 i');
    ok(await page.$('#hud .gear') !== null, '遊戲中有 ⚙');
    await ctx.close(); }

  console.log('\n[I5] 首頁（選玩法／格數／顏色…）在手機高度內一頁放得下，不用上下捲動');
  { const { page, ctx } = await open(browser, { viewport: { width: 390, height: 656 } });
    await page.evaluate(() => { document.getElementById('voiceWarn').innerHTML = ''; });   // 測試用的假語音沒有台灣華語，會多一行提醒文字；真的手機有語音就不會出現
    const r = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, vh: innerHeight, btns: [...document.querySelectorAll('#app .big')].map(b => Math.round(b.getBoundingClientRect().bottom)) }));
    ok(r.doc <= r.vh, '整頁不超過螢幕高度（不用捲動）', r);
    ok(r.btns.length === 3 && r.btns.every(b => b <= r.vh), '開始遊戲／排行榜／老師管理中心都在畫面內', r);
    ok(await page.$$eval('#app .cs .panel', e => e.length) === 5, '五個設定區塊都在');
    ok(await page.$eval('#app .cs .panel', e => !!e.querySelector('.opt.on')), '玩法有選中的選項');
    ok(await page.$$eval('#app .cs .panel:nth-child(n+3) .opts, #app .cs .panel .opts', es => es.every(o => o.getBoundingClientRect().width > 100)), '各區塊選項寬度足夠點');
    await ctx.close(); }

  await browser.close();
  const c = H.counts();
  console.log('\n通過 ' + c.pass + '，失敗 ' + c.fail);
  process.exit(c.fail ? 1 : 0);
})();
