// 色數消消樂：教師區常駐訂閱規則說明（Playwright + firebase modular 替身）
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
let pass = 0, fail = 0;
const ok = (c, n, x) => { if(c){ pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x !== undefined ? '→ ' + JSON.stringify(x) : ''); } };

const APP = `export const initializeApp=(cfg,name)=>({name:name||'[DEFAULT]',options:cfg});`;
const AUTH = `
const user=window.__USER;
export const getAuth=app=>({currentUser:app.name==='central'?user:null,authStateReady:async()=>{},app});
export const signInAnonymously=async()=>({user:{uid:'anon',isAnonymous:true}});
export class GoogleAuthProvider{}
export const signInWithPopup=async()=>{};
export const signOut=async()=>{};
export const onAuthStateChanged=(a,cb)=>setTimeout(()=>cb(a.currentUser),0);`;
const FS = `
const D=window.__DATA=window.__DATA||{};
const wrap=d=>{if(!d)return d;const o=JSON.parse(JSON.stringify(d));['expiresAt','startAt'].forEach(k=>{if(typeof o[k]==='number'){const v=o[k];o[k]={toMillis:()=>v};}});return o;};
export const getFirestore=app=>({app});
export const collection=(db,...p)=>({path:p.join('/')});
export const doc=(db,...p)=>({path:p.join('/'),id:p[p.length-1]});
export const query=(c)=>c; export const orderBy=()=>0; export const limit=()=>0; export const where=()=>0;
export const getDoc=async r=>({exists:()=>D[r.path]!==undefined,data:()=>wrap(D[r.path]),id:r.id});
export const getDocs=async()=>({docs:[]});
export const setDoc=async(r,d)=>{D[r.path]=JSON.parse(JSON.stringify(d));};
export const updateDoc=async(r,d)=>{D[r.path]=Object.assign(D[r.path]||{},d);};
export const deleteDoc=async r=>{delete D[r.path];};
export const writeBatch=()=>({set(){},delete(){},commit:async()=>{}});
export const serverTimestamp=()=>Date.now();
export const Timestamp={fromMillis:m=>m};`;

async function open(browser, plan){
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if(u.startsWith('http://localhost')) return r.continue();
    const js = b => r.fulfill({ status: 200, contentType: 'application/javascript', body: b });
    if(u.endsWith('/firebase-app.js')) return js(APP);
    if(u.endsWith('/firebase-auth.js')) return js(AUTH);
    if(u.endsWith('/firebase-firestore.js')) return js(FS);
    return r.abort();
  });
  const data = {};
  if(plan) data['site_plans/u1'] = { plan, expiresAt: Date.now() + 90 * 86400000 };
  await page.addInitScript('window.__USER={uid:"u1",email:"teacher@example.com",displayName:"T",isAnonymous:false,emailVerified:true};window.__DATA=' + JSON.stringify(data) + ';');
  await page.goto((process.env.BASE_URL || 'http://localhost:8766') + '/index.html');
  await page.waitForFunction(() => window.TA && typeof renderTeacher === 'function');
  await page.evaluate(() => renderTeacher());
  await page.waitForSelector('.rules');
  return { page, errors, ctx };
}

(async () => {
  const browser = await chromium.launch();
  for(const plan of [null, 'year']){
    console.log('\n[' + (plan ? '訂閱帳號' : '免費帳號') + ']');
    const { page, errors, ctx } = await open(browser, plan);
    const badge = await page.$eval('.badge', e => e.textContent);
    ok(plan ? badge === '訂閱' || badge === '年訂' : badge === '免費', '方案徽章正確', badge);
    ok(await page.$eval('.rules', e => e.offsetParent !== null), '規則說明常駐可見');
    ok((await page.$$('.rules li')).length === 6, '共 6 條規則');
    // 繁體 + 西文
    await page.evaluate(() => setC('aux', 'es'));
    let r = await page.evaluate(() => ({ title: document.querySelector('.rules').previousElementSibling.innerHTML, li: [...document.querySelectorAll('.rules li')].map(e => e.innerHTML) }));
    ok(/訂閱規則說明/.test(r.title) && /Reglas de la suscripción/.test(r.title), '繁體標題＋西文小字', r.title);
    ok(/免費：最多 3 組設定/.test(r.li[0]) && /Gratis: hasta 3/.test(r.li[0]), '第 1 條：免費 3 組（繁＋西）');
    ok(/最多 15 組設定/.test(r.li[1]) && /最多 12 個/.test(r.li[1]) && /3 個班級/.test(r.li[1]), '第 2 條：訂閱 15 組、12 色、3 班');
    ok(/不會刪除任何設定/.test(r.li[2]) && /自訂顏色或自訂數字/.test(r.li[2]), '第 3 條：到期不刪、pro 設定連結暫停');
    // 英文
    await page.evaluate(() => setC('aux', 'en'));
    r = await page.evaluate(() => [...document.querySelectorAll('.rules li')].map(e => e.innerHTML));
    ok(/Free: up to 3 configurations/.test(r[0]) && /Subscriber: up to 15/.test(r[1]) && /Once you renew/.test(r[5]), '英文小字正確');
    // 不顯示外語
    await page.evaluate(() => setC('aux', 'none'));
    r = await page.evaluate(() => [...document.querySelectorAll('.rules li')].map(e => e.innerHTML));
    ok(r.every(h => !/<small>/.test(h)), '關閉外語時沒有小字');
    // 簡體
    await page.evaluate(() => { setC('simp', true); setC('aux', 'none'); });
    r = await page.evaluate(() => ({ title: document.querySelector('.rules').previousElementSibling.textContent, li: [...document.querySelectorAll('.rules li')].map(e => e.textContent) }));
    ok(r.title === '订阅规则说明' && r.li[0].startsWith('免费：最多 3 组设置') && r.li[4].includes('导出'), '簡體正確', r.title);
    await page.evaluate(() => setC('simp', false));
    // 規則與程式實際額度一致
    const lims = await page.evaluate(() => ({ lim: limitN(), pro: isPro() }));
    ok(lims.lim === (plan ? 15 : 3), '程式實際上限 = 規則寫的（' + (plan ? 15 : 3) + '）', lims);
    ok(errors.filter(e => !/Failed to load resource|net::ERR/.test(e)).length === 0, '沒有 JS 錯誤', errors);
    await ctx.close();
  }
  await browser.close();
  console.log('\n結果：通過 ' + pass + '，失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
