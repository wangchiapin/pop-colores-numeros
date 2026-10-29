// 步驟 5-3：色數消消樂遊戲本身的測試（共用 ⚙️ 設定、拼音／注音、評語、結果畫面、老師連結、班級回傳）
// 用法：node tests/run.js（Firebase modular v10 由這裡的替身取代，不會碰到真的資料庫）
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
let pass = 0, fail = 0;
const ok = (c, n, x) => { if(c){ pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x !== undefined ? '→ ' + JSON.stringify(x) : ''); } };
const BASE = process.env.BASE_URL || 'http://localhost:8766';
const KEY = 'hanziGames.settings';

const APP = `export const initializeApp=(cfg,name)=>({name:name||'[DEFAULT]',options:cfg});`;
const AUTH = `
export const getAuth=app=>({currentUser:null,authStateReady:async()=>{},app});
export const signInAnonymously=async()=>({user:{uid:'anon',isAnonymous:true}});`;
const FS = `
const D=window.__DATA=window.__DATA||{};
export const getFirestore=app=>({app});
export const collection=(db,...p)=>({path:p.join('/')});
export const doc=(db,...p)=>({path:p.join('/'),id:p[p.length-1]});
export const query=(c)=>c; export const orderBy=()=>0; export const limit=()=>0; export const where=()=>0;
export const getDoc=async r=>({exists:()=>D[r.path]!==undefined,data:()=>JSON.parse(JSON.stringify(D[r.path])),id:r.id});
export const getDocs=async q=>({docs:Object.keys(D).filter(k=>k.startsWith(q.path+'/')&&k.split('/').length===q.path.split('/').length+1).map(k=>({id:k.split('/').pop(),data:()=>JSON.parse(JSON.stringify(D[k]))}))});
export const setDoc=async(r,d)=>{D[r.path]=JSON.parse(JSON.stringify(d));};
export const updateDoc=async(r,d)=>{D[r.path]=Object.assign(D[r.path]||{},d);};
export const serverTimestamp=()=>Date.now();`;

const CID = 'class0000aaaa', CID2 = 'class0000bbbb', SID = 'cfg000011112', SID2 = 'cfg000022223';
const DATA = {
  // （維修測試時，open 會再加 portalStatus/center-colores）
  ['classes/' + CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: false },
  ['classes/' + CID2]: { owner: 'u1', slot: 1, name: '週五班', showBoard: true },
  // 別的設定組的成績：排行榜不應該出現
  ['class_scores/' + CID2 + '_colores_' + SID2 + '_' + 'a'.repeat(16)]: { cid: CID2, owner: 'u1', game: 'colores', k: SID2, h: 'a'.repeat(16), nick: 'Zed', best: 999, plays: 1, lastAt: 1, extra: {} },
  ['shared_configs/' + SID]: { owner: 'u1', pro: true, cfg: { name: '自訂色', mode: 'A', rows: 3, cols: 3, hearts: 5, ids: ['red'],
    custom: [{ n: '天空藍', s: '天空藍色', h: '#7fd1ff', p: 'tiān kōng lán' }, { n: '米白', s: '', h: '#f5f0e1' }], range: 999 } }
};

async function open(browser, { qs = '', ls = null, speech = false, maint = false } = {}){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', r => {
    const u = r.request().url();
    if(u.startsWith('http://localhost')) return r.continue();
    const js = b => r.fulfill({ status: 200, contentType: 'application/javascript', body: b });
    if(u.endsWith('/firebase-app.js')) return js(APP);
    if(u.endsWith('/firebase-auth.js')) return js(AUTH);
    if(u.endsWith('/firebase-firestore.js')) return js(FS);
    return r.abort();
  });
  await page.addInitScript('window.__DATA=' + JSON.stringify(DATA) + ';');
  if(maint) await page.addInitScript("window.__DATA['portalStatus/center-colores']={off:true};");
  if(ls) await page.addInitScript('try{' + Object.keys(ls).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(ls[k]) + ');').join('') + '}catch(e){}');
  if(speech) await page.addInitScript(`
    window.__rates=[];window.SpeechSynthesisUtterance=function(t){this.text=t;};
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){},speak(u){window.__rates.push(u.rate);setTimeout(()=>u.onend&&u.onend(),10);}}});`);
  await page.goto(BASE + '/index.html' + qs);
  await page.waitForTimeout(400);
  return { page, ctx, errors };
}
const settings = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const txt = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());

(async () => {
  const browser = await chromium.launch();

  console.log('\n[1] 共用設定：預設、從色數舊設定搬過來、跟跑吧共用');
  { const { page, ctx, errors } = await open(browser);
    const s = await settings(page);
    ok(s && s.script === 'trad' && s.lang === 'es' && s.phon === 'pinyin' && s.rate === 'normal', '第一次寫入預設', s);
    ok(await page.evaluate(() => typeof renderTeacher === 'undefined' && typeof renderAdmin === 'undefined'), '遊戲內教師區、管理頁已刪除');
    ok(await page.$eval('a.big[href*="profesor"]', a => a.href) === 'https://wangchiapin.github.io/profesor/#/home', '老師管理中心按鈕連到中心');
    ok((await txt(page, 'a.big[href*="profesor"]')).includes('老師管理中心'), '按鈕文字「老師管理中心」');
    ok(!(await page.$('#app .panel h3 small')) || !(await page.evaluate(() => [...document.querySelectorAll('#app .panel h3')].some(h => /中文字形|輔助語言|語速/.test(h.textContent)))), '開始畫面不再有字形／輔助語言／語速');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { shushu_cfg: JSON.stringify({ mode: 'B', grid: 1, simp: true, aux: 'none', rate: 0.55, showText: true }) } });
    const s = await settings(page);
    ok(s.script === 'simp' && s.lang === 'zh' && s.rate === 'slow', '舊設定 simp／aux:none／rate 0.55 → 簡體／只有中文／慢', s);
    ok(await page.evaluate(() => cfg.mode === 'B' && cfg.grid === 1 && cfg.showText === true), '玩法設定保留');
    ok((await txt(page, '#app h1')) === '色数消消乐', '標題簡體');
    ok(await page.$$eval('#app .panel h3 small', e => e.length) === 0, '只有中文：沒有外語小字');
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'en', phon: 'off', rate: 'fast', other: 1 }), shushu_cfg: JSON.stringify({ aux: 'es' }) } });
    ok((await txt(page, '#app .big')).includes('Start'), '跑吧存的「中＋英」色數也跟著用');
    ok(await page.evaluate(() => cfg.rate === 0.85 && cfg.aux === 'en'), '語速「快」→ 0.85（和其他遊戲同一組語速）');
    await ctx.close(); }

  console.log('\n[2] ⚙️ 視窗');
  { const { page, ctx } = await open(browser, { speech: true, ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'es', phon: 'pinyin', rate: 'normal', other: 7 }) } });
    await page.click('#app .gear');
    ok(await page.$eval('#setov', e => !e.classList.contains('hide')), '按 ⚙️ 跳出設定視窗');
    await page.click('#setov [onclick="setS(\'phon\',\'zhuyin\')"]');
    await page.click('#setov [onclick="setS(\'lang\',\'en\')"]');
    await page.click('#setov [onclick="setS(\'rate\',\'slow\')"]'); await page.waitForTimeout(150);
    const s = await settings(page);
    ok(s.phon === 'zhuyin' && s.lang === 'en' && s.rate === 'slow' && s.other === 7, '存回共用鑰匙，別款欄位保留', s);
    ok((await page.evaluate(() => window.__rates)).pop() === 0.45, '改語速會試聽（慢 0.45）');
    await page.click('#setov .big');
    ok(await page.$eval('#setov', e => e.classList.contains('hide')), '按完成關掉');
    ok((await txt(page, '#app .big')).includes('Start'), '關掉後畫面換成中＋英');
    await ctx.close(); }

  console.log('\n[3] 遊戲中：拼音／注音、⚙️ 暫停');
  { const { page, ctx, errors } = await open(browser, { speech: true });
    await page.evaluate(() => { cfg.showText = true; startGame(stdG(), 'std'); }); await page.waitForTimeout(200);
    const red = await page.$eval('.cbtn', e => e.innerText.replace(/\s+/g, ' ').trim());
    ok(red === 'hóng 紅 rojo', '顏色按鈕：拼音在上、中文、西文小字', red);
    ok((await page.$eval('#qtext .ph', e => e.textContent)).length > 0, '題目文字上面有拼音');
    await page.click('#hud .gear');
    ok(await page.evaluate(() => S.paused), '遊戲中按 ⚙️ 先暫停');
    await page.click('#setov [onclick="setS(\'phon\',\'zhuyin\')"]');
    ok((await page.$eval('.cbtn .ph', e => e.textContent)) === 'ㄏㄨㄥˊ', '改注音馬上生效', await page.$eval('.cbtn .ph', e => e.textContent));
    await page.click('#setov [onclick="setS(\'phon\',\'both\')"]');
    ok(await page.$$eval('.cbtn:first-child .ph', e => e.length) === 2, '兩個都顯示');
    await page.click('#setov [onclick="setS(\'phon\',\'off\')"]');
    ok(await page.$$eval('.cbtn .ph', e => e.length) === 0, '關：沒有拼音');
    await page.click('#setov .big');
    ok(await page.evaluate(() => !S.paused), '按完成繼續');
    ok(await page.evaluate(() => S.cells.length === 20 && document.querySelectorAll('.cell').length === 20), '改設定不會重開一局');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  console.log('\n[3b] 答錯震動、答對煙火');
  { const { page, ctx, errors } = await open(browser, { speech: true });
    await page.evaluate(() => { window.__vib = []; navigator.vibrate = n => { window.__vib.push(n); return true; }; startGame(stdG(), 'std'); }); await page.waitForTimeout(200);
    await page.evaluate(() => { const bad = Object.keys(S.cmap).find(id => id !== S.cells[S.cur].color); answerA(bad, null); });
    ok(await page.evaluate(() => window.__vib.length === 1 && window.__vib[0] === 200), '答錯：手機震動 200 毫秒');
    ok(await page.$eval('#boardWrap', e => e.classList.contains('shake')), '答錯：整個方塊區抖動');
    await page.evaluate(() => answerA(S.cells[S.cur].color, null));
    ok(await page.$$eval('.spark', e => e.length) === 12, '答對：方塊消失處噴出 12 顆煙火點');
    await page.waitForTimeout(900);
    ok(await page.$$eval('.spark', e => e.length) === 0, '煙火播完自動清掉');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await open(browser);
    const r = await page.evaluate(() => [pyOf('一百一十'), pyOf('三十六'), pyOf('兩千零五'), pyOf('深藍色'), pyOf('米白')]);
    ok(r[0] === 'yì bǎi yì shí' && r[1] === 'sān shí liù' && r[2] === 'liǎng qiān líng wǔ' && r[3] === 'shēn lán sè' && r[4] === '', '數字與顏色的拼音（一百 唸 yì；不認得的字不顯示）', r);
    await page.evaluate(() => startGame(Object.assign(stdG(), { mode: 'B' }), 'std')); await page.waitForTimeout(150);
    const k = await page.$eval('.key:nth-child(4)', e => e.innerText.replace(/\s+/g, ' ').trim());
    ok(k === 'liǎng 兩 dos', '數字鍵：拼音在上', k);
    await ctx.close(); }

  console.log('\n[4] 老師連結：自訂顏色的拼音');
  { const { page, ctx, errors } = await open(browser, { qs: '?c=' + SID });
    await page.waitForFunction(() => screen === 'link');
    ok(!(await page.evaluate(() => [...document.querySelectorAll('#app .panel h3')].some(h => /中文字形|輔助語言|語速/.test(h.textContent)))), '連結開始畫面也沒有基本設定（改在 ⚙️）');
    ok(await page.$('#app .gear') !== null, '連結開始畫面有 ⚙️');
    await page.click('#app .big');
    await page.waitForSelector('.cbtn');
    const btns = await page.$$eval('.cbtn', es => es.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    ok(btns.includes('tiān kōng lán 天空藍'), '老師填的拼音顯示在自訂顏色上', btns);
    ok(btns.includes('米白'), '沒有拼音的自訂顏色只顯示字', btns);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[5] 結果畫面：評語與順序');
  { const { page, ctx } = await open(browser);
    const keys = await page.evaluate(() => {
      startGame(stdG(), 'std');
      const out = [];
      const setDone = n => S.cells.forEach((c, i) => { c.alive = i >= n; });
      setDone(4); out.push(commentKey(false));       // 20%
      setDone(6); out.push(commentKey(false));       // 30%
      setDone(15); out.push(commentKey(false));      // 75%
      setDone(20); S.hearts = 3; out.push(commentKey(true));
      S.hearts = 5; out.push(commentKey(true));
      return out.join(',');
    });
    ok(keys === 'k0,k1,k2,k3,k4', '五級評語：<25%／25–49%／50–99%／全清／全清且愛心沒少', keys);
    await page.evaluate(() => { S.cells.forEach((c, i) => { c.alive = i >= 12; }); finish(false); });
    ok((await txt(page, '#commentLine')) === '很好，差一點就清完了！ ¡Muy bien, ya casi lo logras!', '評語中＋西', await txt(page, '#commentLine'));
    const order = await page.$$eval('#over .card > *', es => es.map(e => e.id || e.className || e.tagName));
    ok(order.indexOf('commentLine') < order.indexOf('lbArea') && order.indexOf('lbArea') < order.lastIndexOf('big'), '順序：評語 → 排行榜 → 再玩一次 → 主選單', order);
    await ctx.close(); }
  { const { page, ctx, errors } = await open(browser, { qs: '?c=' + SID + '&class=' + CID, ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'en', phon: 'pinyin', rate: 'normal' }) } });
    await page.waitForFunction(() => screen === 'link');
    await page.fill('#app input.txt', 'Leo'); await page.dispatchEvent('#app input.txt', 'input');
    await page.click('#app .big'); await page.waitForSelector('.cbtn');
    await page.evaluate(() => finish(false));
    await page.waitForFunction(() => document.getElementById('classArea').innerText.includes('已回傳'));
    ok((await txt(page, '#classArea')) === '✅ 成績已回傳給老師 Result sent to your teacher', '「成績已回傳給老師」中＋英', await txt(page, '#classArea'));
    const order = await page.$$eval('#over .card > *', es => es.map(e => e.id || e.tagName));
    ok(order.indexOf('commentLine') < order.indexOf('classArea'), '評語在回傳訊息前面', order);
    ok(await page.evaluate(cid => Object.keys(window.__DATA).some(k => k.startsWith('class_scores/' + cid + '_colores_')), CID), '成績寫進 class_scores');
    const rec = await page.evaluate(cid => Object.entries(window.__DATA).find(([k, v]) => k.startsWith('class_scores/' + cid + '_')), CID);
    ok(rec && rec[1].k === SID && rec[0] === 'class_scores/' + CID + '_colores_' + SID + '_' + rec[1].h, '步驟 6-2：設定記成設定碼，文件 id = 班級_colores_設定碼_暱稱', rec);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { // 步驟 6-2：班級排行榜只比同一個設定組
    const { page, ctx, errors } = await open(browser, { qs: '?c=' + SID + '&class=' + CID2 });
    await page.waitForFunction(() => screen === 'link');
    await page.fill('#app input.txt', 'Leo'); await page.dispatchEvent('#app input.txt', 'input');
    await page.click('#app .big'); await page.waitForSelector('.cbtn');
    await page.evaluate(() => finish(false));
    await page.waitForFunction(() => document.querySelector('#classArea table'), null, { timeout: 5000 }).catch(() => {});
    const t = await txt(page, '#classArea');
    ok(t.includes('Leo') && !t.includes('Zed'), '班級排行榜只列同一個設定組（別組的 Zed 不出現）', t);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  { // 2026-10-29：老師中心維修開關開啟 → 所有學生連結都不能玩、不記成績；?preview 不受影響
    for(const q of ['?c=' + SID, '?c=' + SID + '&class=' + CID]){
      const { page, ctx, errors } = await open(browser, { qs: q, maint: true });
      const t = await txt(page, '#app');
      ok(t.includes('維修中') || t.includes('mantenimiento'), '維修中：連結顯示維修中 ' + q, t);
      ok(!(await page.$('#app input.txt')) && !(await page.$('.cbtn')), '維修中：沒有輸入名字、沒有遊戲畫面 ' + q);
      ok(errors.length === 0, '沒有程式錯誤', errors); await ctx.close(); }
    const { page, ctx } = await open(browser, { qs: '?c=' + SID + '&class=' + CID + '&preview=1', maint: true, ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'en', phon: 'pinyin', rate: 'normal' }) } });
    await page.waitForFunction(() => screen === 'link', null, { timeout: 5000 }).catch(() => {});
    ok(!!(await page.$('#app .big')), '預覽（?preview）不受維修影響');
    await ctx.close(); }
  { // 2026-10-29：?preview（老師試玩班級連結）不回傳成績
    const { page, ctx, errors } = await open(browser, { qs: '?c=' + SID + '&class=' + CID + '&preview=1', ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'en', phon: 'pinyin', rate: 'normal' }) } });
    await page.waitForFunction(() => screen === 'link');
    await page.fill('#app input.txt', 'Preview'); await page.dispatchEvent('#app input.txt', 'input');
    await page.click('#app .big'); await page.waitForSelector('.cbtn');
    await page.evaluate(() => finish(false));
    await page.waitForFunction(() => document.getElementById('classArea').innerText.includes('預覽'));
    ok((await txt(page, '#classArea')).includes('不會回傳'), '預覽模式：顯示成績不會回傳', await txt(page, '#classArea'));
    ok(await page.evaluate(cid => !Object.keys(window.__DATA).some(k => k.startsWith('class_scores/' + cid + '_colores_')), CID), '預覽模式：沒有寫進 class_scores');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { // 2026-10-29：老師訂閱到期（permission-denied）→ 明確提示、不出現重試鈕
    const { page, ctx, errors } = await open(browser, { qs: '?c=' + SID + '&class=' + CID, ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'en', phon: 'pinyin', rate: 'normal' }) } });
    await page.waitForFunction(() => screen === 'link');
    await page.fill('#app input.txt', 'Leo'); await page.dispatchEvent('#app input.txt', 'input');
    await page.click('#app .big'); await page.waitForSelector('.cbtn');
    await page.evaluate(() => { window.TA.classSubmit = async () => { throw { code: 'permission-denied' }; }; });
    await page.evaluate(() => finish(false));
    await page.waitForFunction(() => document.getElementById('classArea').innerText.includes('無法記錄'));
    ok(!(await page.$('#classArea button')), '訂閱到期：提示請通知老師，沒有重試鈕');
    await ctx.close(); }

  await browser.close();
  console.log('\n通過 ' + pass + '，失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
