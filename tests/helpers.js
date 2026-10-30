// 新增測試共用的小工具（不是測試檔，run.js 不會直接執行它）：
// 開頁面（假 Firebase、假語音）、讀方塊、用畫面按鈕作答。
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const BASE = process.env.BASE_URL || 'http://localhost:8766';
const KEY = 'hanziGames.settings';

let pass = 0, fail = 0;
const ok = (c, n, x) => { if(c){ pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x !== undefined ? '→ ' + JSON.stringify(x) : ''); } };
const counts = () => ({ pass, fail });

const APP = `export const initializeApp=(cfg,name)=>({name:name||'[DEFAULT]',options:cfg});`;
const AUTH = `
export const getAuth=app=>{ if(!app.__auth) app.__auth={currentUser:null,authStateReady:async()=>{}}; return app.__auth; };
export const signInAnonymously=async(a)=>{ a.currentUser={uid:'anon',isAnonymous:true}; return {user:a.currentUser}; };`;
// 假 Firestore：支援 orderBy／limit／where(==)，排行榜才排得出順序
const FS = `
const D=window.__DATA=window.__DATA||{}; window.__pid=window.__pid||0;
const cl=x=>JSON.parse(JSON.stringify(x));
export const getFirestore=app=>({app});
export const collection=(db,...p)=>({path:p.join('/')});
export const doc=(db,...p)=>({path:p.join('/'),id:p[p.length-1]});
export const query=(c,...cons)=>({path:c.path,cons});
export const orderBy=(f,d)=>({t:'o',f,d}); export const limit=n=>({t:'l',n}); export const where=(f,op,v)=>({t:'w',f,op,v});
export const getDoc=async r=>({exists:()=>D[r.path]!==undefined,data:()=>cl(D[r.path]),id:r.id});
export const getDocs=async q=>{
  let ds=Object.keys(D).filter(k=>k.startsWith(q.path+'/')&&k.split('/').length===q.path.split('/').length+1).map(k=>({id:k.split('/').pop(),v:cl(D[k])}));
  (q.cons||[]).forEach(c=>{
    if(c.t==='w'&&c.op==='==')ds=ds.filter(d=>d.v[c.f]===c.v);
    if(c.t==='o'){ds.sort((a,b)=>(a.v[c.f]<b.v[c.f]?-1:a.v[c.f]>b.v[c.f]?1:0)*(c.d==='desc'?-1:1));}
    if(c.t==='l')ds=ds.slice(0,c.n);
  });
  return {docs:ds.map(d=>({id:d.id,data:()=>cl(d.v)}))};
};
export const setDoc=async(r,d)=>{D[r.path]=cl(d);};
export const addDoc=async(c,d)=>{const id='p'+(++window.__pid);D[c.path+'/'+id]=cl(d);return {id};};
export const updateDoc=async(r,d)=>{D[r.path]=Object.assign(D[r.path]||{},cl(d));};
export const serverTimestamp=()=>Date.now();`;
const SPEECH = `
  window.__spoken=[];window.__rates=[];window.SpeechSynthesisUtterance=function(t){this.text=t;};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){},speak(u){window.__spoken.push(u.text);window.__rates.push(u.rate);setTimeout(()=>u.onend&&u.onend(),10);}}});`;

const CID = 'class0000aaaa';
const BASE_DATA = { ['classes/' + CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: false } };

// data：額外塞進假資料庫的文件；ls：先寫進 localStorage 的東西；maint：維修開關
async function open(browser, { qs = '', ls = null, data = null, maint = false, viewport = { width: 390, height: 844 } } = {}){
  const ctx = await browser.newContext({ viewport, acceptDownloads: true }); const page = await ctx.newPage();
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
  await page.addInitScript('window.__DATA=' + JSON.stringify(Object.assign({}, BASE_DATA, data || {})) + ';');
  if(maint) await page.addInitScript("window.__DATA['portalStatus/center-colores']={off:true};");
  if(ls) await page.addInitScript('try{' + Object.keys(ls).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(ls[k]) + ');').join('') + '}catch(e){}');
  await page.addInitScript(SPEECH);
  await page.goto(BASE + '/index.html' + qs);
  await page.waitForTimeout(400);
  return { page, ctx, errors };
}

// ---- 獨立於遊戲程式的「標準答案」 ----
const COLOR_TABLE = { 紅: '#e53935', 黃: '#fdd835', 藍: '#1e88e5', 綠: '#2e9e4f', 黑: '#111', 白: '#fff', 灰: '#9e9e9e', 橘: '#fb8c00', 紫: '#7b1fa2', 粉紅: '#ff80ab', 咖啡: '#6d4c41', 深灰: '#555', 淺灰: '#d3d3d3', 深藍: '#0d2f7a', 淺藍: '#7fd1ff', 深綠: '#1b5e20', 淺綠: '#a5e08f' };
const BASIC = ['紅', '黃', '藍', '綠', '黑', '白', '灰', '橘', '紫'];
const ADV = ['紅', '黃', '橘', '紫', '黑', '白', '粉紅', '咖啡', '深灰', '淺灰', '深藍', '淺藍', '深綠', '淺綠'];
const rgb = h => { h = h.replace('#', ''); if(h.length === 3) h = h.split('').map(c => c + c).join(''); return 'rgb(' + [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')'; };
const RGB_OF_NAME = Object.fromEntries(Object.entries(COLOR_TABLE).map(([n, h]) => [n + '色', rgb(h)]));   // '紅色' → 'rgb(...)'
const RGB_OF_SHORT = Object.fromEntries(Object.entries(COLOR_TABLE).map(([n, h]) => [n, rgb(h)]));
// 中文數字 → 數字（驗證「語音唸的」和「方塊上的數字」一致）
function parseCN(s){
  const d = { 零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }, u = { 十: 10, 百: 100, 千: 1000 };
  let total = 0, cur = 0;
  for(const ch of s){ if(ch in d) cur = d[ch]; else if(ch in u){ total += (cur || 1) * u[ch]; cur = 0; } else return NaN; }
  return total + cur;
}
// 數字 → 玩家要按的中文（和遊戲一樣：百、千位的 2 唸「兩」）
function toCN(n){
  if(n === 0) return '零';
  const D = '零一二三四五六七八九', U = ['千', '百', '十', ''], ds = [Math.floor(n / 1000) % 10, Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  let s = '', z = false;
  ds.forEach((d, i) => { if(d === 0){ if(s) z = true; return; } if(z){ s += '零'; z = false; } if(i === 2 && d === 1 && s === '') s += '十'; else s += ((d === 2 && i < 2) ? '兩' : D[d]) + U[i]; });
  return s;
}

// ---- 讀畫面 ----
const cellsInfo = page => page.$$eval('#board .cell', es => es.map((e, i) => ({ i, n: Number(e.textContent), rgb: getComputedStyle(e).backgroundColor, alive: !e.classList.contains('empty') })));
const lastSpoken = page => page.evaluate(() => window.__spoken[window.__spoken.length - 1]);
const txt = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
const hidden = (page, sel) => page.$eval(sel, e => e.classList.contains('hide'));

// ---- 開始一局：按畫面上的 opt 選項（用文字找），再按開始 ----
const clickOpt = (page, text) => page.locator('#app .opt', { hasText: text }).first().click();
const isOn = (page, text) => page.locator('#app .opt', { hasText: text }).first().evaluate(e => e.classList.contains('on'));
async function waitQ(page, prevQid = 0){
  await page.waitForFunction(q => S && (S.ended || (S.qid > q && !S.busy && window.__spoken[window.__spoken.length - 1] === S.qspeak)), prevQid, { timeout: 8000 });
}
async function startStd(page){ await page.locator('#app > .big').first().click(); await page.waitForSelector('#board'); await waitQ(page, 0); }

// ---- 作答（全部用畫面按鈕）----
// A：從語音內容找出被問的方塊 → 點跟它同色的顏色按鈕。回傳 {spoken, n, match}
async function answerA(page, { correct = true } = {}){
  const st = await page.evaluate(() => ({ qid: S.qid, cur: S.cur, spoken: window.__spoken[window.__spoken.length - 1] }));
  const cells = await cellsInfo(page);
  const target = cells[st.cur];
  const btns = await page.$$eval('.cbtn', es => es.map(e => getComputedStyle(e).backgroundColor));
  const idx = correct ? btns.indexOf(target.rgb) : btns.findIndex(c => c !== target.rgb);
  await page.click('.cbtn:nth-child(' + (idx + 1) + ')');
  return { qid: st.qid, spoken: st.spoken, n: target.n, match: parseCN(st.spoken) === target.n };
}
async function typeB(page, str){
  for(const ch of str){
    const idx = await page.$$eval('.key .zh', (es, c) => es.findIndex(e => e.textContent === c), ch);
    await page.click('.key:nth-child(' + (idx + 1) + ')');
  }
}
// B：聽到顏色 → 在盤面找同色且還活著的方塊 → 按它的數字 → 確認
async function answerB(page){
  const st = await page.evaluate(() => ({ qid: S.qid, spoken: window.__spoken[window.__spoken.length - 1] }));
  const want = RGB_OF_NAME[st.spoken];
  const cells = (await cellsInfo(page)).filter(c => c.alive && c.rgb === want);
  if(!cells.length) return { qid: st.qid, spoken: st.spoken, n: null, known: !!want };
  await typeB(page, toCN(cells[0].n));
  await page.click('.key.ok');
  return { qid: st.qid, spoken: st.spoken, n: cells[0].n, known: !!want };
}
// B 的錯誤作答：按一個盤面上完全沒有的數字
async function wrongB(page){
  const cells = (await cellsInfo(page)).filter(c => c.alive);
  const used = new Set(cells.map(c => c.n)); let n = 0; while(used.has(n)) n++;
  await typeB(page, toCN(n));
  await page.click('.key.ok');
  return n;
}
const hudHearts = page => page.$eval('#hearts', e => e.textContent);
const hudScore = page => page.$eval('#sc', e => Number(e.textContent));

// 清完整盤（A 或 B），回傳每題的檢查結果
async function clearBoard(page, mode){
  const res = [];
  for(let g = 0; g < 80; g++){
    const done = await page.evaluate(() => S.ended || S.cells.every(c => !c.alive));
    if(done) break;
    const qid = await page.evaluate(() => S.qid);
    res.push(mode === 'A' ? await answerA(page) : await answerB(page));
    await waitQ(page, qid);
  }
  return res;
}
// 輸掉：A 連按 N 次錯顏色（愛心用完）
async function loseA(page, wrongTimes){
  for(let i = 0; i < wrongTimes; i++){ await answerA(page, { correct: false }); await page.waitForTimeout(40); }
  await page.waitForSelector('#over:not(.hide)', { timeout: 4000 });
}
const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

module.exports = { chromium, BASE, KEY, ok, counts, open, COLOR_TABLE, BASIC, ADV, RGB_OF_NAME, RGB_OF_SHORT, rgb, parseCN, toCN, cellsInfo, lastSpoken, txt, hidden, clickOpt, isOn, waitQ, startStd, answerA, answerB, wrongB, typeB, hudHearts, hudScore, clearBoard, loseA, b64url, CID };
