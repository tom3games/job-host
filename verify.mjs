// 検証。node verify.mjs（音は出さない）。スマホ縦3サイズ × 全画面 × Chromium/WebKit、会話の噛み合い、分岐、稼ぎ方、罠、英語、OGP
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
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
  // 名刺（返事）の文字が名刺からはみ出していない
  for (const el of document.querySelectorAll('#cards .card')) if (el.scrollHeight > el.clientHeight + 1) over.push('card-text:' + el.textContent)
  // 吹き出しが名刺に重なっていない
  const b = document.querySelector('#bubble'), h = document.querySelector('#hand')
  if (b && !b.hidden && !b.closest('[hidden]') && b.getBoundingClientRect().bottom > h.getBoundingClientRect().top - (document.querySelector('#clue').hidden ? 0 : document.querySelector('#clue').offsetHeight) + 1) over.push('bubble-on-hand')
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
const toTurn = async q => { for (let i = 0; i < 900; i++) { const s = await q.evaluate(() => { HC.dbg.step(10); return HC.state() }); if (s.phase === 'turn' && s.mode === 'play') return s; if (s.mode === 'end' || s.mode === 'raid') return s } throw new Error('turn に届かない') }
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'big']]

// 全画面を巡る（同じ手順を Chromium と WebKit で）
async function walk(q, tag, name, shotPrefix) {
  const chk = async (v) => {
    const f = await fit(q), o = await overflow(q), n = await textCount(q)
    await t(`${tag} ${name} ${v}: 一画面・はみ出しなし・文字2つまで`, async () => { expect(!f.over.length && o.sw <= o.W && !o.bad.length && n <= 2, JSON.stringify({ f, o, n })) })
    if (shotPrefix) await q.screenshot({ path: `${ROOT}/shots/${shotPrefix}-${v}.png` })
  }
  await chk('title')
  await q.click('#bHow'); await chk('how'); await q.click('#howBtn')
  await q.click('#bStart'); await q.evaluate(() => HC.dbg.pause(true)); await chk('intro')
  await q.click('#bSaySkip'); await toTurn(q); await chk('play')
  // 一番長い返事の並ぶ一歩でも名刺に収まる
  await q.evaluate(() => { const t = HC.G.tb, all = HC.T.GUESTS.flatMap(g => [g.hello, ...g.topics.flat(), g.rescue, g.close]); const L = n => Math.max(...n.o.map(o => (o.t[document.documentElement.lang] || o.t.ja).length)); const node = all.reduce((a, n) => L(n) > L(a) ? n : a); t.choices = null; HC.G.tb.node = node; HC.setLang(document.documentElement.lang) })
  await chk('longest')
  await q.evaluate(() => HC.openMenu()); await chk('menu'); await q.evaluate(() => HC.closeMenu())
  await q.evaluate(() => { const t = HC.G.tb; t.mood = 95; t.walletYen = 1500000; t.tier = 2; HC.offerBottle() })
  await run(q, 90); await q.waitForTimeout(50); await run(q, 60); await q.waitForTimeout(400); await chk('call')
  await q.evaluate(() => HC.callEnd()); await toTurn(q)
  await q.evaluate(() => HC.ura('love')); await q.waitForTimeout(250); await chk('stop')
  await q.evaluate(() => HC.stopOk()); await toTurn(q)
  await q.evaluate(() => HC.ura('tsuke')); await run(q, 150); await q.waitForTimeout(250); await chk('raid')
  await q.evaluate(() => HC.result()); await run(q, 130); await q.waitForTimeout(100); await chk('end')
  await t(`${tag} ${name} エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
}

await t('会話データの検算（1歩に当たり・弱い・外すが1つずつ／当たりは本音の型／字数／英語）', async () => {
  const out = execFileSync(process.execPath, ['tools/dialogue.mjs'], { cwd: ROOT, encoding: 'utf8' }); return out.trim()
})

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
await t('index.html の ?v= がすべて同じ番号（script・import・画像）', async () => {
  const r = await p.evaluate(async () => { const h = await (await fetch('index.html')).text(), g = await (await fetch('game.js')).text(); const vs = [...h.matchAll(/\.(?:js|webp)\?v=(\d+)/g), ...g.matchAll(/\.js\?v=(\d+)/g), ...g.matchAll(/const V = '\?v=(\d+)'/g)].map(m => m[1]); return [...new Set(vs)] })
  expect(r.length === 1, JSON.stringify(r)); return r
})
await p.evaluate(() => HC.dbg.pause(true))
const fresh = (seed, guest) => p.evaluate(([s, g]) => { HC.start(s, { skipIntro: true, guest: g }); return true }, [seed, guest])
const pickI = (q, f) => q.evaluate(f => { const s = HC.state(), i = s.grades.findIndex((g, i) => (new Function('g', 'st', 'return ' + f))(g, s.styles[i])); HC.choose(i); return { i, s } }, f)

await t('[噛み合い] 全客の通しで、出ている3択は今の一言への返事だけ（札の山から引かない）', async () => {
  const bad = [], seen = new Set()
  for (const k of await p.evaluate(() => HC.T.GUESTS.map(g => g.k))) {
    for (const seed of [1, 2]) {
      await fresh(seed, k); let n = 0
      for (let i = 0; i < 40; i++) {
        const s = await toTurn(p); if (s.mode !== 'play') break
        const r = await p.evaluate(() => { const t = HC.G.tb, n = t.node, ok = HC.state().cards.every(c => n.o.some(o => o.t.ja === c)) && n.o.length === 3, b = document.querySelector('#bubble').textContent === n.s.ja; return { ok, b, line: n.s.ja } })
        if (!r.ok || !r.b) bad.push(k + ':' + r.line); seen.add(k + r.line); n++
        await p.evaluate(() => { const s = HC.state(); HC.choose(s.grades.indexOf(Math.random() < .7 ? 'H' : 'W')) })
      }
    }
  }
  expect(!bad.length, bad.join(' / ')); return { lines: seen.size }
})
await t('[くじ] どの客が来るかは毎回くじ。同じ種なら同じ客と話題順、種を変えると話題順が変わる', async () => {
  const v = await p.evaluate(() => {
    const who = new Set(), sig = s => { const t = HC.buildPlay(s); return t.g.k + ':' + t.wallet + ':' + t.topics.map(x => x[0].s.ja).join('/') }
    for (let s = 1; s <= 200; s++) who.add(HC.buildPlay(s).g.k)
    const orders = new Set(); for (let s = 1; s <= 30; s++) orders.add(HC.buildPlay(s, 'g1').topics.map(x => x[0].s.ja).join('/'))
    return { guests: who.size, same: sig(9) === sig(9), orders: orders.size }
  })
  expect(v.guests === 11 && v.same && v.orders >= 8, JSON.stringify(v)); return v
})
await t('[分岐] 当たりは同じ話題を深掘り、外すと1回だけ挽回の一歩、2回目の外しは話題が変わる', async () => {
  await fresh(4, 'g1'); await toTurn(p); await pickI(p, "g==='H'"); let s = await toTurn(p)
  expect(s.kind === 'topic', 'after hello ' + s.kind)
  const first = s.line; await pickI(p, "g==='H'"); s = await toTurn(p)
  const deeper = await p.evaluate(() => HC.G.tb.si); expect(s.kind === 'topic' && deeper === 1 && s.line !== first, 'deepen ' + JSON.stringify({ k: s.kind, deeper }))
  await pickI(p, "g==='M'"); s = await toTurn(p); expect(s.kind === 'rescue', 'rescue ' + s.kind)
  const m0 = s.mood; await pickI(p, "g==='H'"); const m1 = await p.evaluate(() => HC.G.tb.mood); expect(m1 - m0 === 18, 'rescue +' + (m1 - m0))
  s = await toTurn(p); expect(s.kind === 'topic' && (await p.evaluate(() => HC.G.tb.si)) === 0, 'new topic')
  await pickI(p, "g==='M'"); s = await toTurn(p); expect(s.kind === 'topic', 'no 2nd rescue ' + s.kind)
})
await t('[分岐] 同じ客でも、返事を変えると流れが変わる', async () => {
  const path = async f => { await fresh(5, 'g3'); const lines = []; for (let i = 0; i < 6; i++) { const s = await toTurn(p); if (s.mode !== 'play') break; lines.push(s.line); await pickI(p, f) } return lines.join('/') }
  const a = await path("g==='H'"), b = await path("g==='M'"); expect(a !== b, a); return { hit: a.split('/').length, miss: b.split('/').length }
})
await t('[反応] 返事を選ぶと、その返事に書いた客の反応が読める時間だけ出る', async () => {
  await fresh(6, 'g2'); await toTurn(p)
  const r = await p.evaluate(() => { const s = HC.state(), i = s.grades.indexOf('H'), want = HC.G.tb.choices[i].r.ja; HC.choose(i); const b0 = document.querySelector('#bubble').textContent; const need = Math.max(1.6, .9 + .09 * want.length); HC.dbg.step(Math.floor(need * 60) - 2); return { want, b0, still: document.querySelector('#bubble').textContent === want, need } })
  expect(r.b0 === r.want && r.still, JSON.stringify(r)); return r
})
await t('[押し売り] 楽しませる前のボトルは失敗し売上0、2回で帰る', async () => {
  await fresh(3, 'g2'); await toTurn(p)
  const a = await p.evaluate(() => { HC.offerBottle(); const t = HC.G.tb; return { sales: t.spent, strikes: t.strikes, mood: t.mood } }); expect(a.sales === 0 && a.strikes === 1 && a.mood === 12, JSON.stringify(a))
  await toTurn(p); await p.evaluate(() => HC.offerBottle()); const b = await toTurn(p); await run(p, 200)
  const c = await p.evaluate(() => HC.state()); expect(c.mode === 'end' && c.sales === 0 && c.rk === 'zero', JSON.stringify({ b: b.mode, c }))
})
await t('[段階] ボトルは安い順に1本ずつ。メニューで押せるのは次の1本だけ', async () => {
  await fresh(3, 'g2'); await toTurn(p)
  const v = await p.evaluate(() => { const t = HC.G.tb; t.mood = 100; HC.openMenu(); const btn = [...document.querySelectorAll('#mItems .mi')].map(b => !b.disabled); HC.closeMenu(); HC.offerBottle(); return { btn, tier: t.tier, spent: t.spent } })
  expect(v.btn.join() === 'true,false,false,false' && v.tier === 1 && v.spent === 30000, JSON.stringify(v))
  await p.evaluate(() => HC.callEnd()); await toTurn(p)
  const w = await p.evaluate(() => { const t = HC.G.tb; t.mood = 50; HC.offerBottle(); return { tier: t.tier, strikes: t.strikes } }); expect(w.tier === 1 && w.strikes === 1, '2本目は楽しませてから ' + JSON.stringify(w))
})
await t('[財布] 財布を超える勧めは、その場で帰って指名も残らない', async () => {
  await fresh(3, 'x_tax'); await toTurn(p)
  const v = await p.evaluate(() => { const t = HC.G.tb; t.mood = 100; t.tier = 2; t.spent = 130000; HC.offerBottle(); return t.walletYen }); await run(p, 400)
  const s = await p.evaluate(() => HC.state()); expect(v === 150000 && s.mode === 'end' && !s.happy && s.sales === 130000, JSON.stringify(s))
})
await t('[持ちネタ] 同じ持ちネタを2回言うと冷める', async () => {
  await fresh(8, 'g3'); await toTurn(p)
  const v = await p.evaluate(() => { const t = HC.G.tb, step = t.g.topics.flat().find(n => n.o.some(o => o.st === 'n')), go = () => { t.node = step; t.kind = 'topic'; t.choices = step.o; t.state = 'turn'; const m = t.mood; HC.choose(step.o.findIndex(o => o.st === 'n')); return t.mood - m }; t.mood = 50; const a = go(); const b = go(); return { a, b, bubble: document.querySelector('#bubble').textContent } })
  expect(v.a === 3 && v.b === -14 && v.bubble === 'それ、さっきも聞いた', JSON.stringify(v)); return v
})
await t('[色恋] 1回目は内勤が止めて会話が続き、2回目は営業停止', async () => {
  await fresh(2, 'g4'); await toTurn(p)
  const a = await p.evaluate(() => { HC.ura('love'); return HC.state() }); expect(a.mode === 'stop' && a.sales === 0 && a.warns === 1, JSON.stringify(a))
  await p.evaluate(() => HC.stopOk()); const s = await toTurn(p); expect(s.mode === 'play' && s.k === 'g4', 'continue ' + JSON.stringify(s))
  const b = await p.evaluate(() => { HC.ura('tsuke'); return HC.state() }); expect(b.mode === 'raid' && b.ended === 'raid', JSON.stringify(b))
  await p.evaluate(() => HC.result()); await run(p, 130); const c = await p.evaluate(() => HC.state()); expect(c.rk === 'raid' && c.net < 0, JSON.stringify(c))
})
await t('[色恋] 帳簿の人の前では1回で営業停止', async () => {
  await fresh(2, 'x_tax'); await toTurn(p); const a = await p.evaluate(() => { HC.ura('love'); return HC.state() }); expect(a.mode === 'raid', JSON.stringify(a))
})
await t('[未成年] 確かめずに売ると営業停止、身分証を見せてもらうと家まで送って見抜き手当', async () => {
  const s = await p.evaluate(() => { for (let s = 1; s < 400; s++) if (HC.buildPlay(s, 'x_young').minor) return s })
  await fresh(s, 'x_young'); await toTurn(p); const a = await p.evaluate(() => { HC.G.tb.mood = 90; HC.offerBottle(); return HC.state() }); expect(a.ended === 'raid', JSON.stringify(a))
  await fresh(s, 'x_young'); const st = await toTurn(p); expect(st.styles.includes('i'), JSON.stringify(st.styles))
  await p.evaluate(() => HC.choose(HC.state().styles.indexOf('i'))); await run(p, 400); const b = await p.evaluate(() => HC.state()); expect(b.minors === 1 && b.rk === 'catch' && b.net > 0, JSON.stringify(b))
  const adult = await p.evaluate(() => { for (let s = 1; s < 400; s++) if (!HC.buildPlay(s, 'x_young').minor) return s })
  await fresh(adult, 'x_young'); await toTurn(p); await p.evaluate(() => { HC.openMenu(); document.querySelector('#mId').click() }); const c = await toTurn(p); expect(c.mode === 'play' && c.checked && c.kind === 'hello', 'menu id ' + JSON.stringify(c))
})
await t('[何もしない] 黙っていると2回で帰り、売上0でクビ', async () => {
  await fresh(1, 'g6'); for (let i = 0; i < 80; i++) await run(p, 60); const s = await p.evaluate(() => HC.state()); expect(s.mode === 'end' && s.sales === 0 && s.rk === 'zero', JSON.stringify(s))
})
await t('[通し] 当たりを読んで勧めどきに勧めると、財布の底まで使って笑って帰る', async () => {
  await fresh(1, 'g2'); let g = 0
  for (; g < 3000; g++) {
    const s = await p.evaluate(() => { HC.dbg.step(30); return HC.state() })
    if (s.mode === 'end') break
    if (s.mode === 'play' && s.phase === 'turn') await p.evaluate(() => { const s = HC.state(); if (s.ready) return HC.offerBottle(); HC.choose(s.grades.indexOf('H')) })
  }
  await run(p, 200); const r = await p.evaluate(() => HC.state())
  expect(r.mode === 'end' && r.sales === 1440000 && r.rk === 'legend' && r.bottles === 4, JSON.stringify(r)); const v = await variance(p, '#slip'); expect(v > 100, 'slip ' + v)
  const head = await p.evaluate(() => document.querySelector('#endLabel').textContent + ' ' + document.querySelector('#endSales').textContent)
  expect(head === 'レイナ姫の会計 ¥1,440,000', head)
  return { sales: r.sales, rk: r.rk, ex: r.ex, head }
})
await t('[判定] 発表までハンコを出さない（stampK が 0 から 1 へ）', async () => {
  await fresh(1, 'g1'); await toTurn(p); await p.evaluate(() => { HC.result() }); const a = await p.evaluate(() => HC.G.result.stampK); await run(p, 200); const b = await p.evaluate(() => HC.G.result.stampK); expect(a === 0 && b === 1, JSON.stringify([a, b]))
})
await t('[TM] 開始・終了・シェアが記録される', async () => {
  const r = await p.evaluate(() => { HC.start(1, { skipIntro: true }); TM.share('x'); HC.result(); return window.__tmLog.map(x => x.name) }); expect(r.includes('game_start') && r.includes('share'), JSON.stringify(r))
})
await t('[音] 効果音は呼ばれる。実際には無音', async () => {
  const r = await p.evaluate(() => ({ played: Object.keys(HC.Snd.played).length, ok: window.__muteOk(), st: HC.Snd.ctx ? HC.Snd.ctx.state : 'none' })); expect(r.played >= 3 && r.ok && r.st !== 'running', JSON.stringify(r))
})
await t('英語の通し: 全部の文字が英語に切り替わる', async () => {
  await p.evaluate(() => { HC.setLang('en'); HC.start(2, { skipIntro: true, guest: 'g5' }) }); await toTurn(p)
  const r = await p.evaluate(() => { HC.openMenu(); const t = [...document.querySelectorAll('.card,#clue,#bubble,#menu span,#menu h3,#menu small,#mBack,#tBottle,#hTable,#hNoms')].map(e => e.textContent).join(' '); HC.closeMenu(); return t })
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(r), r)
  await p.evaluate(() => { HC.ura('love') }); await p.evaluate(() => HC.stopOk()); await toTurn(p); await p.evaluate(() => HC.ura('love')); await run(p, 150); const raid = await p.evaluate(() => document.querySelector('#raidText').textContent + document.querySelector('#raidStamp').textContent)
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(raid), raid)
  await p.evaluate(() => { HC.result() }); await run(p, 130); const end = await p.evaluate(() => document.querySelector('#endLabel').textContent + document.querySelector('#bAgain').textContent + document.querySelector('#bSave').textContent + document.querySelector('#bPost').textContent + (document.querySelector('#tmSupport') || {}).textContent); expect(!/[ぁ-んァ-ヶ一-龠]/.test(end), end)
  await p.evaluate(() => HC.setLang('ja'))
})
await t('データの英語に日本語なし', async () => {
  const r = await p.evaluate(() => { const bad = []; const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.ja === 'string' && typeof o.en === 'string' && /[ぁ-んァ-ヶ一-龠]/.test(o.en)) bad.push(o.en); for (const k in o) walk(o[k]) }; for (const k in HC.D) if (k !== 'UI') walk(HC.D[k]); walk(HC.T.GUESTS); return bad })
  expect(!r.length, JSON.stringify(r))
})
await p.close()

// ---- 3サイズ × 全画面
for (const [w, h, name] of SIZES) { const q = await open(browser, { viewport: { width: w, height: h } }); await walk(q, 'Chromium', name, name === 'small' ? 'v-small' : null); await q.close() }
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
