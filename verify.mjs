// 検証。node verify.mjs（音は出さない）。スマホ縦3サイズ × 全画面 × Chromium/WebKit、遊びの通し、採点、英語、OGP
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5865
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__hcReady, null, { timeout: 15000 }); await p.waitForTimeout(450)
  return p
}
const VIEWS = '#vTitle:not([hidden]) *,#vPlay:not([hidden]) *,#vEnd:not([hidden]) *,#menu:not([hidden]) *,#stop:not([hidden]) *,#raid:not([hidden]) *,#say:not([hidden]) *,#how:not([hidden]) *,#call:not([hidden]) #callBig,#call:not([hidden]) #callSub'
const overflow = p => p.evaluate(sel => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.id === 'stopImg' || el.id === 'sayImg' || el.closest('svg')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 2 || r.left < -2)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
}, VIEWS)
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('button,a,#slip')) { if (el.closest('[hidden]') || !(el.offsetParent || el.getBoundingClientRect().width)) continue; const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
// 画面に同時に出ている文（ボタン以外）を数える。2つまで
const textCount = q => q.evaluate(() => ['#bubble', '#clue', '#stopLine', '#raidText', '#callBig'].filter(s => { const e = document.querySelector(s); return e && !e.closest('[hidden]') && !e.hidden && e.textContent.trim() }).length)
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
const run = (q, n) => q.evaluate(n => HC.dbg.step(n), n)
const toTurn = async q => { for (let i = 0; i < 600; i++) { const s = await q.evaluate(() => { HC.dbg.step(10); return HC.state() }); if (s.phase === 'turn' && s.mode === 'play') return s } throw new Error('turn に届かない') }
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'big']]
const closeBook = q => q.evaluate(() => HC.closeMenu())

// 全画面を巡る（同じ手順を Chromium と WebKit で）
async function walk(q, tag, name, shotPrefix) {
  const chk = async (v, cond) => {
    const f = await fit(q), o = await overflow(q), n = await textCount(q)
    await t(`${tag} ${name} ${v}: 一画面・はみ出しなし・文字2つまで`, async () => { expect(!f.over.length && o.sw <= o.W && !o.bad.length && n <= 2, JSON.stringify({ f, o, n })) })
    if (shotPrefix) await q.screenshot({ path: `${ROOT}/shots/${shotPrefix}-${v}.png` })
  }
  await chk('title')
  await q.click('#bHow'); await chk('how'); await q.click('#howBtn')
  await q.click('#bStart'); await q.evaluate(() => HC.dbg.pause(true)); await chk('intro')
  await q.click('#bSaySkip'); await toTurn(q); await chk('play')
  await q.evaluate(() => HC.openMenu()); await chk('menu'); await closeBook(q)
  await q.evaluate(() => { const t = HC.G.tb; t.senpai = false; t.g = HC.D.REG[0]; t.mood = 90; t.walletYen = 500000; HC.offerBottle(2) })
  await run(q, 60); await q.waitForTimeout(50); await run(q, 60); await q.waitForTimeout(400); await chk('call')
  await q.evaluate(() => HC.callEnd()); await toTurn(q)
  await q.evaluate(() => HC.ura('love')); await q.waitForTimeout(250); await chk('stop')
  await q.evaluate(() => HC.stopOk()); await toTurn(q)
  await q.evaluate(() => HC.ura('tsuke')); await run(q, 150); await q.waitForTimeout(250); await chk('raid')
  await q.evaluate(() => HC.result()); await run(q, 130); await q.waitForTimeout(100); await chk('end')
  await t(`${tag} ${name} エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
}

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('読み込み画面が消える', async () => { await p.waitForTimeout(500); expect(await p.evaluate(() => document.querySelector('#loading').hidden), 'loading') })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式があり、og.png は 1200x630', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
  const size = await p.evaluate(() => new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = 'og.png' }))
  expect(size && size[0] === 1200 && size[1] === 630, JSON.stringify(size))
})
await t('locale ja-JP で日本語', async () => { expect(await p.evaluate(() => document.documentElement.lang === 'ja' && document.querySelector('#bStart').textContent === '入店する'), 'lang') })
await t('privacy.html へのリンクが押せる高さ', async () => {
  await p.click('#bHow'); const r = await p.evaluate(() => { const a = document.querySelector('#howBody a'); return { h: a.getBoundingClientRect().height, href: a.getAttribute('href') } }); await p.click('#howBtn'); expect(r.h >= 38 && r.href === 'privacy.html', JSON.stringify(r))
})
await p.evaluate(() => HC.dbg.pause(true))

// ---- 採点の仕組み（指示の7項目）
const fresh = (seed = 3) => p.evaluate(s => { HC.start(s, { skipIntro: true }); return true }, seed)
const firstReg = async () => { // 普通の客の卓まで進める（1卓目は必ず普通の客）
  await fresh(); return toTurn(p)
}
await t('[押し売り] 楽しませる前のボトルは必ず失敗し売上0、2回で帰る', async () => {
  await firstReg(); const a = await p.evaluate(() => { const t = HC.G.tb; t.senpai = false; t.walletYen = 500000; HC.offerBottle(0); return { sales: HC.G.sales, mood: t.mood, early: t.early } })
  expect(a.sales === 0 && a.early === 1, JSON.stringify(a))
  await toTurn(p); const b = await p.evaluate(() => { HC.offerBottle(0); return HC.G.tb.mood }); expect(b === 0, 'mood ' + b)
})
await t('[押し売り] 地雷「シャンパン入れてくださいよ」は札に入り大きく下がる', async () => {
  const has = await p.evaluate(() => HC.D.MINE.some(m => m.ja.includes('シャンパン'))); expect(has, 'no mine')
  await firstReg(); await p.evaluate(() => { const t = HC.G.tb; t.mood = 50; t.state = 'turn'; t.choices = [{ tag: 'mine', form: 'mine', text: HC.D.MINE[0] }, ...t.choices.slice(1)]; HC.choose(0) })
  expect(await p.evaluate(() => HC.G.tb.mood) === 50 + (await p.evaluate(() => HC.NUM.MINE)), 'mine score')
})
await t('[先回り] 何でも言っては低く、先回りは高い', async () => {
  const r = await p.evaluate(() => { HC.start(3, { skipIntro: true }); return true }); await toTurn(p)
  const v = await p.evaluate(() => {
    const t = HC.G.tb; t.main = 'quiet'; const go = (form, text) => { t.mood = 50; t.state = 'turn'; t.prev = null; t.tags = []; t.used = new Set(); t.choices = [{ tag: 'quiet', form, text }, t.choices[1], t.choices[2]]; HC.choose(0); return t.mood - 50 }
    return { hollow: go('hollow', HC.D.HOLLOW.quiet[0]), real: go('real', HC.D.LINES.quiet[0]) }
  })
  expect(v.real > v.hollow && v.real >= 18 && v.hollow <= 2, JSON.stringify(v)); return v
})
await t('[細部] かわいいは埋もれ、持ち物を拾う言葉が高い。札は卓の持ち物と対応', async () => {
  await fresh(5); await toTurn(p)
  const v = await p.evaluate(() => {
    const t = HC.G.tb; t.main = 'praise'; const go = (form, text) => { t.mood = 50; t.state = 'turn'; t.prev = null; t.tags = []; t.used = new Set(); t.choices = [{ tag: 'praise', form, text }, t.choices[1], t.choices[2]]; HC.choose(0); return t.mood - 50 }
    const detail = (HC.D.DETAIL[t.item.i] || [])[0]
    const inPool = t.pool.praise.some(x => x === detail)
    return { hollow: go('hollow', HC.D.HOLLOW.praise[0]), real: go('real', detail), inPool, item: t.item.i }
  })
  expect(v.real > v.hollow && v.inPool, JSON.stringify(v)); return v
})
await t('[深掘り] 当たった次の手に深掘りが出て、話を変えると下がる', async () => {
  await fresh(7); await toTurn(p)
  const v = await p.evaluate(() => {
    const t = HC.G.tb, i = t.choices.findIndex(c => c.form === 'real' && c.tag === t.main); HC.choose(i); return { i, prev: t.prev }
  })
  expect(v.prev === 'good', JSON.stringify(v)); await toTurn(p)
  const c = await p.evaluate(() => { const t = HC.G.tb; const forms = t.choices.map(c => c.form), m = t.mood, other = t.choices.findIndex(c => c.form === 'real' && c.tag !== t.main && c.tag !== t.sub); if (other >= 0) { HC.choose(other); return { forms, d: t.mood - m, prev: t.prev } } return { forms, d: null } })
  expect(c.forms.includes('deep'), JSON.stringify(c)); if (c.d !== null) expect(c.prev === 'swap' && c.d < 0, JSON.stringify(c)); return c
})
await t('[持ちネタ] 別の客には新鮮、同じ客に同じ話をすると冷める', async () => {
  await fresh(9); await toTurn(p)
  const v = await p.evaluate(() => {
    const t = HC.G.tb; t.main = 'joke'; const n = t.pool.joke[0], go = () => { t.mood = 50; t.state = 'turn'; t.prev = null; t.tags = []; t.choices = [{ tag: 'joke', form: 'real', text: n }, t.choices[1], t.choices[2]]; HC.choose(0); return { d: t.mood - 50, kind: t.prev } }
    const first = go(), second = go(); const nets = HC.G.night.map(x => x.pool.joke.map(j => j.ja)), other = nets.filter((a, i) => a.some(j => nets[0].includes(j))).length
    return { first, second, other }
  })
  expect(v.first.kind === 'good' && v.second.kind === 'bored' && v.other >= 2, JSON.stringify(v)); return v
})
await t('[態度] 冷めるとスマホ・時計、乗るとしぐさで見せる', async () => {
  await fresh(4); await toTurn(p)
  const v = await p.evaluate(() => { const t = HC.G.tb; t.turn = 3; t.mood = 10; HC.dbg.step(1); return { att: HC.state().att, low: HC.D.ATT.low.map(x => x.ja) } })
  expect(v.att === 'low', JSON.stringify(v))
})
await t('[挽回] 滑った直後に挽回の札が1回だけ出て、差し引きはわざと滑っても得しない', async () => {
  await fresh(6); await toTurn(p)
  const v = await p.evaluate(() => { const t = HC.G.tb, i = t.choices.findIndex(c => c.form === 'real' && c.tag !== t.main && c.tag !== t.sub); HC.choose(i >= 0 ? i : t.choices.findIndex(c => c.form !== 'real')); return t.prev })
  await toTurn(p)
  const c = await p.evaluate(() => { const t = HC.G.tb, forms = t.choices.map(c => c.form), i = forms.indexOf('back'), m = t.mood; if (i >= 0) HC.choose(i); return { forms, d: t.mood - m, used: t.comeback, N: HC.NUM } })
  expect(c.forms.includes('back') && c.used && c.d > 0 && c.N.BAD + c.N.COMEBACK < 2 * c.N.GOOD, JSON.stringify({ v, c })); return { d: c.d }
})
await t('[くじ] 同じ種は同じ夜、種を変えると本音が変わる', async () => {
  const v = await p.evaluate(() => { const f = s => HC.buildNight(s).map(t => t.g.k + t.main + t.sub + t.wallet).join(), wants = {}; for (let s = 1; s <= 30; s++) for (const t of HC.buildNight(s)) if (!t.gag) { (wants[t.g.k] = wants[t.g.k] || new Set()).add(t.main) } return { same: f(9) === f(9), diff: f(9) !== f(10), minW: Math.min(...Object.values(wants).map(x => x.size)) } })
  expect(v.same && v.diff && v.minW >= 3, JSON.stringify(v)); return v
})
await t('[色恋] 1回目は内勤が止めて売上0、2回目は営業停止', async () => {
  await fresh(2); await toTurn(p)
  const a = await p.evaluate(() => { HC.ura('love'); return HC.state() }); expect(a.mode === 'stop' && a.sales === 0 && a.warns === 1, JSON.stringify(a))
  await p.evaluate(() => HC.stopOk()); await toTurn(p); const b = await p.evaluate(() => { HC.ura('tsuke'); return HC.state() }); expect(b.mode === 'raid' && b.ended === 'raid', JSON.stringify(b))
  await p.evaluate(() => HC.result()); await run(p, 130); const c = await p.evaluate(() => HC.state()); expect(c.rk === 'raid' && c.net < 0, JSON.stringify(c))
})
await t('[先輩の客] ボトルは罰金、盛り上げるとヘルプ手当', async () => {
  const seed = await p.evaluate(() => { for (let s = 1; s < 80; s++) if (HC.buildNight(s).some(t => t.senpai)) return s })
  await fresh(seed); const v = await p.evaluate(() => HC.buildNight(HC.G.seed).findIndex(t => t.senpai))
  await p.evaluate(v => HC.dbg.jump(v), v); const st = await toTurn(p)
  expect(st.senpai, JSON.stringify(st))
  const r = await p.evaluate(() => { HC.offerBottle(0); return HC.state() }); expect(r.mode === 'stop' && r.fines === 1 && r.sales === 0, JSON.stringify(r)); await p.evaluate(() => HC.stopOk())
  await p.evaluate(v => HC.dbg.jump(v), v); await toTurn(p); for (let i = 0; i < 8; i++) { const c = await p.evaluate(() => HC.state()); if (c.idx !== v) break; if (c.phase === 'turn') await p.evaluate(() => { const t = HC.G.tb; t.mood = 80; HC.choose(t.choices.findIndex(c => c.form !== 'mine')) }); await p.evaluate(() => HC.dbg.step(200)) }
  const h = await p.evaluate(() => HC.state().helps); expect(h === 1, 'helps ' + h)
})
await t('[未成年] 確かめずに売ると営業停止、確かめると帰して手当', async () => {
  const s = await p.evaluate(() => { for (let s = 1; s < 400; s++) if (HC.buildNight(s).some(t => t.g.young && t.minor)) return s })
  const go = async () => { await fresh(s); const v = await p.evaluate(s => HC.buildNight(s).findIndex(t => t.g.young), s); await p.evaluate(v => HC.dbg.jump(v), v); const st = await toTurn(p); if (st.young) return st; throw new Error('young ' + JSON.stringify(st)) }
  await go(); const a = await p.evaluate(() => { HC.G.tb.mood = 90; HC.offerBottle(0); return HC.state() }); expect(a.ended === 'raid', JSON.stringify(a))
  const st = await go(); expect(st.choices.includes('id'), JSON.stringify(st.choices)); const b = await p.evaluate(() => { HC.choose(HC.state().choices.indexOf('id')); return HC.state() }); expect(b.minors === 1, JSON.stringify(b))
})
await t('[通し] 読むプレイで閉店まで行き、給料明細が描ける', async () => {
  await fresh(1); let g = 0
  for (; g < 5000; g++) {
    const s = await p.evaluate(() => { HC.dbg.step(30); return HC.state() })
    if (s.mode === 'stop') await p.evaluate(() => HC.stopOk())
    if (s.mode === 'end') break
    if (s.mode === 'play' && s.phase === 'turn') await p.evaluate(() => { const c = HC.state(); if (c.young && !c.checked) return HC.choose(c.choices.indexOf('id')); if (c.att === 'lean' || c.att === 'full') { if (!c.senpai) return HC.offerBottle(0) } let i = c.forms.indexOf('deep'); if (i < 0) i = HC.G.tb.choices.findIndex(x => x.form === 'real' && x.tag === HC.G.tb.main); if (i < 0) i = c.forms.indexOf('real'); HC.choose(Math.max(i, 0)) })
  }
  await run(p, 200); const r = await p.evaluate(() => HC.state())
  expect(r.mode === 'end' && r.sales > 0, JSON.stringify(r)); const v = await variance(p, '#slip'); expect(v > 100, 'slip ' + v)
  return { sales: r.sales, rk: r.rk, net: r.net, v }
})
await t('[判定] 発表までハンコを出さない（stampK が 0 から 1 へ）', async () => {
  await fresh(1); await p.evaluate(() => { HC.result() }); const a = await p.evaluate(() => HC.G.result.stampK); await run(p, 200); const b = await p.evaluate(() => HC.G.result.stampK); expect(a === 0 && b === 1, JSON.stringify([a, b]))
})
await t('[TM] 開始・終了・シェアが記録される', async () => {
  const r = await p.evaluate(() => { HC.start(1, { skipIntro: true }); TM.share('x'); HC.result(); return window.__tmLog.map(x => x.name) }); expect(r.includes('game_start') && r.includes('share'), JSON.stringify(r))
})
await t('[音] 効果音は呼ばれる。実際には無音', async () => {
  const r = await p.evaluate(() => ({ played: Object.keys(HC.Snd.played).length, ok: window.__muteOk(), st: HC.Snd.ctx ? HC.Snd.ctx.state : 'none' })); expect(r.played >= 3 && r.ok && r.st !== 'running', JSON.stringify(r))
})
await t('英語の通し: 全部の文字が英語に切り替わる', async () => {
  await p.evaluate(() => { HC.setLang('en'); HC.start(2, { skipIntro: true }) }); const s = await toTurn(p)
  const r = await p.evaluate(() => { HC.openMenu(); const t = [...document.querySelectorAll('.card,#clue,#bubble,#menu span,#menu h3,#menu small,#mBack,#tBottle,#hTable')].map(e => e.textContent).join(' '); HC.closeMenu(); return t })
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(r), r)
  await p.evaluate(() => { HC.ura('love') }); await p.evaluate(() => HC.stopOk()); await toTurn(p); await p.evaluate(() => HC.ura('love')); await run(p, 150); const raid = await p.evaluate(() => document.querySelector('#raidText').textContent + document.querySelector('#raidStamp').textContent)
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(raid), raid)
  await p.evaluate(() => { HC.result() }); await run(p, 130); const end = await p.evaluate(() => document.querySelector('#bAgain').textContent + document.querySelector('#bSave').textContent + document.querySelector('#bPost').textContent + (document.querySelector('#tmSupport') || {}).textContent); expect(!/[ぁ-んァ-ヶ一-龠]/.test(end), end)
  await p.evaluate(() => HC.setLang('ja'))
})
// 英語の全データに日本語が混ざっていない
await t('データの英語に日本語なし・日本語は短い（カード22字まで）', async () => {
  const r = await p.evaluate(() => { const bad = [], long = []; const walk = (o, tag) => { if (!o || typeof o !== 'object') return; if (o.ja !== undefined && o.en !== undefined) { if (/[ぁ-んァ-ヶ一-龠]/.test(o.en)) bad.push(o.en); if (['LINES', 'NETA', 'HOLLOW', 'DETAIL', 'DEEP', 'MINE', 'COMEBACK'].includes(tag) && o.ja.length > 22) long.push(o.ja) } for (const k in o) walk(o[k], tag) }; for (const k in HC.D) if (k !== 'UI') walk(HC.D[k], k); return { bad, long } })
  expect(!r.bad.length && !r.long.length, JSON.stringify(r))
})
await p.close()

// ---- 3サイズ × 全画面
for (const [w, h, name] of SIZES) { const q = await open(browser, { viewport: { width: w, height: h } }); await walk(q, 'Chromium', name, name === 'small' ? 'v-small' : null); await q.close() }
// 英語の一画面
const qe = await open(browser, { viewport: { width: 360, height: 640 } }); await qe.evaluate(() => HC.setLang('en')); await walk(qe, 'English', 'small', 'v-en'); await qe.close()
await browser.close()
// ---- WebKit（iPhone 相当）
const wb = await webkit.launch()
for (const [w, h, name] of SIZES) { const q = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2, viewport: { width: w, height: h } }); await walk(q, 'WebKit', name, name === 'phone' ? 'v-webkit' : null)
  await t(`WebKit ${name}: 無音`, async () => { expect(await q.evaluate(() => window.__muteOk()), 'mute') })
  await q.close() }
const wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始められて無音', async () => { await wp.tap('#bStart'); await wp.waitForTimeout(200); expect(await wp.evaluate(() => !document.querySelector('#say').hidden && window.__muteOk()), 'start') })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
