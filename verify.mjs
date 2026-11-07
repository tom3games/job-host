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
  await q.evaluate(() => { const t = HC.G.tb, all = [...HC.T.HELLO, ...HC.T.TOPICS.flat(), ...HC.T.CLOSE]; const L = n => Math.max(...n.o.map(o => (o.t[document.documentElement.lang] || o.t.ja).length)); const node = all.reduce((a, n) => L(n) > L(a) ? n : a); t.choices = null; HC.G.tb.node = node; HC.setLang(document.documentElement.lang) })
  await chk('longest')
  await q.evaluate(() => HC.openMenu()); await chk('menu'); await q.evaluate(() => HC.closeMenu())
  // 事件（状況の一行が出る元カレ・横から入る店長の母・連打）
  await q.evaluate(() => HC.forceEvent('ex', 'alone')); await run(q, 30); await chk('event-ex'); await q.evaluate(() => HC.dbg.step(400)); await toTurn(q)
  await q.evaluate(() => HC.forceEvent('mom')); await run(q, 30); await chk('event-mom'); await q.evaluate(() => HC.dbg.step(400)); await toTurn(q)
  await q.evaluate(() => HC.forceEvent('spill')); await run(q, 30); await chk('event-spill'); await q.evaluate(() => HC.dbg.step(400)); await toTurn(q)
  await q.evaluate(() => { const t = HC.G.tb; t.mood = 95; t.walletYen = 1500000; t.tier = 2; HC.offerBottle() })
  await run(q, 90); await q.waitForTimeout(50); await run(q, 60); await q.waitForTimeout(400); await chk('call')
  await q.evaluate(() => HC.callEnd()); await toTurn(q)
  await q.evaluate(() => HC.ura('love')); await q.waitForTimeout(250); await chk('stop')
  await q.evaluate(() => HC.stopOk()); await toTurn(q)
  await q.evaluate(() => HC.ura('tsuke')); await run(q, 150); await q.waitForTimeout(250); await chk('raid')
  await q.evaluate(() => HC.result()); await run(q, 130); await q.waitForTimeout(100); await chk('end')
  await t(`${tag} ${name} エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
}

await t('会話・事件データの検算（1歩に5つの型が1つずつ／字数／英語／どの本音にも手がかり2つ以上）', async () => {
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
await t('?v= がそろっている（index.html の script・og・game.js の import と画像）', async () => {
  const r = await p.evaluate(async () => { const h = await (await fetch('index.html')).text(), g = await (await fetch('game.js')).text(); const vs = [...h.matchAll(/\.(?:js|webp|png)\?v=(\d+)/g), ...g.matchAll(/\.js\?v=(\d+)/g), ...g.matchAll(/const V = '\?v=(\d+)'/g)].map(m => m[1]); return [...new Set(vs)] })
  expect(r.length === 1, JSON.stringify(r)); return r
})
await p.evaluate(() => { HC.dbg.pause(true); localStorage.setItem('jh_tut_i', '1'); localStorage.setItem('jh_tut', '1'); localStorage.setItem('jh_played', '1') })
const fresh = (seed, guest, o = {}) => p.evaluate(([s, g, o]) => { HC.start(s, { skipIntro: true, guest: g, ...o }); return true }, [seed, guest, o])
const pickI = (q, f) => q.evaluate(f => { const s = HC.state(), i = s.grades.findIndex((g, i) => (new Function('g', 'st', 'return ' + f))(g, s.styles[i])); HC.choose(i); return { i, s } }, f)
const toTurnNoEv = async q => { for (let i = 0; i < 900; i++) { const s = await q.evaluate(() => { HC.dbg.step(10); const s = HC.state(); if (s.mode === 'event' && s.ev.state === 'on') { if (s.ev.kind === 'two') HC.choose(s.ev.opts.indexOf(HC.evCorrect(HC.G.ev, HC.G.tb))); else if (s.ev.shown) for (let k = 0; k < 9; k++) HC.choose(0) } return HC.state() }); if (s.phase === 'turn' && s.mode === 'play') return s; if (s.mode === 'end' || s.mode === 'raid') return s } throw new Error('turn に届かない') }

await t('[推理] 同じ一言でも、本音が違えば当たりの返事が変わる', async () => {
  const r = await p.evaluate(() => { const node = HC.T.HELLO[0], hits = {}; for (const w of HC.T.WANTS) { const t = HC.buildPlay(3, 'g1', { want: w }); hits[w] = node.o.find(o => o.st === t.want).t.ja } return hits })
  expect(new Set(Object.values(r)).size === 5, JSON.stringify(r)); return r
})
await t('[推理] 3択には毎回、本音の返事がちょうど1つ。ほかの2つは別の型（全客・2つの種で通し）', async () => {
  const bad = []; let n = 0
  for (const k of await p.evaluate(() => HC.T.GUESTS.map(g => g.k))) for (const seed of [1, 2]) {
    await fresh(seed, k)
    for (let i = 0; i < 14; i++) {
      const s = await toTurnNoEv(p); if (s.mode !== 'play') break
      const hits = s.styles.filter(st => st === s._want).length, cardsOk = s.cards.every(c => s.texts.includes(c)), bub = s.gag === 'oji' ? /^ほ/.test(s.bubble) && s.clue.includes(s.line) : s.bubble === s.line
      if (hits !== 1 || new Set(s.styles).size !== 3 || !cardsOk || !bub) bad.push(`${k}:${s.line}:${s.styles}`); n++
      await p.evaluate(() => { const s = HC.state(); HC.choose(Math.random() < .7 ? s.grades.indexOf('H') : s.grades.indexOf('M')) })
    }
  }
  expect(!bad.length, bad.slice(0, 4).join(' / ')); return { turns: n }
})
await t('[推理] 卓の持ち物2つを重ねると本音が1つに絞れ、しぐさも本音を指す（全客×80回のくじ）', async () => {
  const r = await p.evaluate(() => { const bad = []; let n = 0; for (const g of HC.T.GUESTS) for (let s = 1; s <= 80; s++) { const t = HC.buildPlay(s, g.k); let w = [...'ljpqs']; for (const k of t.items) w = w.filter(x => HC.T.ITEMS[k].w.includes(x)); n++; if (t.items.length !== 2 || w.length !== 1 || w[0] !== t.want) bad.push(g.k + s + ':' + t.items) } return { n, bad: bad.slice(0, 3) } })
  expect(!r.bad.length, JSON.stringify(r.bad))
  await fresh(5, 'g4'); const s = await toTurnNoEv(p); expect(s.gestW && s.gestW.includes(s._want), JSON.stringify(s.gestW)); return { plays: r.n }
})
await t('[推理] 本音は毎回くじ。同じ客でも回によって違う本音になる', async () => {
  const r = await p.evaluate(() => { const o = {}; for (const g of HC.T.GUESTS) { const s = new Set(); for (let i = 1; i <= 40; i++) s.add(HC.buildPlay(i, g.k).want); o[g.k] = s.size } return o })
  expect(Object.values(r).every(n => n === 3), JSON.stringify(r)); return r
})
await t('[推理] 口調では当たりが分からない（一番丁寧そうな札が当たりの割合が半分未満）', async () => {
  const r = await p.evaluate(() => { const polite = t => (t.match(/です|ます|ください|ましょう|ませ/g) || []).length * 100 + t.length; let hit = 0, n = 0
    const steps = [...HC.T.HELLO, ...HC.T.TOPICS.flat(), ...HC.T.CLOSE]
    for (let s = 1; s <= 300; s++) { const t = HC.buildPlay(s, 'g1', { want: 'ljpqs'[s % 5] }); for (const node of steps) { const hitO = node.o.find(o => o.st === t.want), rest = t.shuffle(node.o.filter(o => o !== hitO)).slice(0, 2), c = [hitO, ...rest]; let b = 0; c.forEach((o, i) => { if (polite(o.t.ja) > polite(c[b].t.ja)) b = i }); if (b === 0) hit++; n++ } }
    return +(hit / n).toFixed(2) })
  expect(r < 0.5, String(r)); return { toneHitRate: r }
})
await t('[推理] 外すと冷めた一言が本音のヒントになり、当たると笑う', async () => {
  await fresh(7, 'g5', { want: 'q' }); await toTurnNoEv(p)
  const a = await p.evaluate(() => { const s = HC.state(); HC.choose(s.grades.indexOf('M')); return { b: document.querySelector('#bubble').textContent, cold: HC.T.COLD.q.map(c => c.ja), face: HC.G.tb.reactFx.kind } })
  expect(a.cold.includes(a.b) && a.face === 'c', JSON.stringify(a))
  await toTurnNoEv(p); const b = await p.evaluate(() => { const s = HC.state(), m = HC.G.tb.mood; HC.choose(s.grades.indexOf('H')); return { d: HC.G.tb.mood - m, face: HC.G.tb.reactFx.kind } })
  expect(b.d === 14 && b.face === 'h', JSON.stringify(b))
})
await t('[推理] 卓の物を押すと説明が出る', async () => {
  await fresh(2, 'g1'); await toTurnNoEv(p)
  const r = await p.evaluate(() => { const k = HC.tapTable(HC.SPOT[0].x, 880); return { k, clue: document.querySelector('#clue').textContent, want: HC.T.ITEMS[k].ja } })
  expect(r.k && r.clue === r.want, JSON.stringify(r)); return r.clue
})
await t('[途中で変わる] ユナとカエデは5往復目で本音が変わり、持ち物が入れ替わって合図が出る', async () => {
  for (const k of ['g3', 'g6']) {
    await fresh(9, k); let before = null
    for (let i = 0; i < 30; i++) { const s = await toTurnNoEv(p); if (s.ex === 4) before = s; if (s.ex >= 5) { expect(before && s._want !== before._want && s.items.join() !== before.items.join() && /酔って/.test(s.clue), JSON.stringify({ k, b: before && before._want, a: s._want, clue: s.clue })); break } await p.evaluate(() => HC.choose(HC.state().grades.indexOf('H'))) }
  }
})
await t('[ほうさん] 「ほう」しか言わず、内勤の通訳が一言を出す。当たりは持ち物で読める', async () => {
  await fresh(4, 'x_oji'); const s = await toTurnNoEv(p)
  expect(/^ほ/.test(s.bubble) && s.clue.startsWith('通訳「') && s.clue.includes(s.line), JSON.stringify(s)); await p.evaluate(() => HC.choose(HC.state().grades.indexOf('H')))
  const r = await p.evaluate(() => ({ b: document.querySelector('#bubble').textContent, c: document.querySelector('#clue').textContent })); expect(r.b === 'ほう！！' && r.c.startsWith('通訳「'), JSON.stringify(r))
})
await t('[時間] 制限時間は読む時間より長く、ボトルの段が上がるほど短い（バーは無い）', async () => {
  const r = await p.evaluate(() => {
    const read = s => 0.9 + 0.09 * [...s].length, out = []
    for (const tier of [0, 1, 2, 3]) { HC.start(12, { skipIntro: true, guest: 'g2' }); for (let i = 0; i < 300; i++) { HC.dbg.step(5); if (HC.state().phase === 'turn' && HC.state().mode === 'play') break } const t = HC.G.tb; t.tier = tier; const s = HC.state(); HC.G.tb.choices = null; HC.setLang('ja'); out.push({ tier, lim: +HC.state().limit.toFixed(2), line: read(s.line) }) }
    return { out, bar: !!document.querySelector('#timer'), hand: [...document.querySelectorAll('#hand *')].some(e => /scaleX/.test(e.style.transform)) }
  })
  expect(!r.bar && !r.hand, 'bar'); for (const o of r.out) expect(o.lim >= o.line + 1.5 && o.lim <= 16, JSON.stringify(o))
  expect(r.out[0].lim > r.out[3].lim, JSON.stringify(r.out)); return r.out.map(o => o.lim)
})
await t('[時間] グラスの泡が減っていき、消えた瞬間に無言扱い（機嫌が下がり冷めた反応）', async () => {
  await fresh(3, 'g4'); const s0 = await toTurnNoEv(p)
  const r = await p.evaluate(() => { const a = HC.state().foam; HC.dbg.step(Math.floor(HC.state().left * 60 / 2)); const b = HC.state().foam; const m = HC.G.tb.mood; HC.dbg.step(Math.ceil(HC.state().left * 60) + 2); return { a, b, d: HC.G.tb.mood - m, sil: HC.state().silent, face: HC.G.tb.reactFx.kind, bub: document.querySelector('#bubble').textContent } })
  expect(r.a > 0.95 && r.b > 0.4 && r.b < 0.6 && r.d === -14 && r.sil === 1 && r.face === 'c', JSON.stringify(r)); return r
})
await t('[時間] 無言が3回続くと帰る（2回では帰らない）', async () => {
  await fresh(1, 'g6'); let s
  for (let i = 0; i < 2; i++) { s = await toTurnNoEv(p); await p.evaluate(() => HC.dbg.step(Math.ceil(HC.state().left * 60) + 2)) }
  s = await toTurnNoEv(p); expect(s.mode === 'play' && s.silent === 2, 'after 2 ' + JSON.stringify(s.mode))
  await p.evaluate(() => HC.dbg.step(Math.ceil(HC.state().left * 60) + 2)); await run(p, 400); const e = await p.evaluate(() => HC.state()); expect(e.mode === 'end' && e.silent === 3 && e.rk === 'zero', JSON.stringify({ m: e.mode, s: e.silent, rk: e.rk }))
})
await t('[事件] 1プレイ2〜3回、種類はくじで重ならない。全種類が出て、レアもたまに出る', async () => {
  const r = await p.evaluate(() => { const seen = {}, n = {}; let rare = 0, dup = 0; for (let s = 1; s <= 400; s++) { const t = HC.buildPlay(s); const ks = t.evQ.map(e => e.k); n[ks.length] = (n[ks.length] || 0) + 1; if (new Set(ks).size !== ks.length) dup++; for (const k of ks) { seen[k] = (seen[k] || 0) + 1; if (HC.D.EVENTS[k].rare) rare++ } } return { n, seen, rare, dup } })
  expect(!r.dup && Object.keys(r.n).every(k => k === '2' || k === '3') && Object.keys(r.seen).length === Object.keys(await p.evaluate(() => HC.D.EVENTS)).length && r.rare > 20 && r.rare < 150, JSON.stringify(r)); return r
})
await t('[事件] 正しくさばくと機嫌が上がり、間違えると下がる。時間切れはしくじり扱い', async () => {
  const one = async (k, how, cue) => { await fresh(2, 'g1', { want: 'l' }); await toTurnNoEv(p); return p.evaluate(([k, how, cue]) => { HC.forceEvent(k, cue); const m = HC.G.tb.mood, s = HC.state(), ok = HC.evCorrect(HC.G.ev, HC.G.tb)
    if (how === 'ok') HC.choose(s.ev.opts.indexOf(ok)); else if (how === 'ng') HC.choose(s.ev.opts.findIndex(o => o !== ok)); else HC.dbg.step(Math.ceil(HC.state().left * 60) + 2)
    return { d: HC.G.tb.mood - m, ok: HC.G.evOk, all: HC.G.evAll, bub: document.querySelector('#bubble').textContent } }, [k, how, cue]) }
  const a = await one('shimei', 'ok'), b = await one('shimei', 'ng'), c = await one('mom', 'timeout')
  expect(a.d === 12 && a.ok === 1 && b.d === -25 && b.ok === 0 && c.d === -18 && c.ok === 0 && c.all === 1, JSON.stringify({ a, b, c })); return { a: a.bub, b: b.bub, c: c.bub }
})
await t('[事件] 元カレは状況の一行で正解が変わり、写真は客の本音で正解が変わる', async () => {
  const r = await p.evaluate(() => { HC.start(2, { skipIntro: true, guest: 'g2', want: 'j' }); for (let i = 0; i < 300; i++) { HC.dbg.step(5); if (HC.state().phase === 'turn' && HC.state().mode === 'play') break }
    const out = {}; for (const [k, c] of [['ex', 'gf'], ['ex', 'alone'], ['photo', null]]) { HC.G.mode = 'play'; HC.G.tb.state = 'turn'; HC.forceEvent(k, c); out[k + (c || '')] = { ans: HC.evCorrect(HC.G.ev, HC.G.tb), clue: document.querySelector('#clue').hidden ? null : document.querySelector('#clue').textContent }; HC.G.ev.state = 'done' }
    HC.G.tb.want = 's'; HC.G.mode = 'play'; HC.G.tb.state = 'turn'; HC.forceEvent('photo'); out.photoS = HC.evCorrect(HC.G.ev, HC.G.tb); return out })
  expect(r.exgf.ans === 'toast' && r.exalone.ans === 'hide' && /彼女/.test(r.exgf.clue) && r.photo.ans === 'funny' && r.photoS === 'cool', JSON.stringify(r)); return r
})
await t('[事件] 連打は回数が足りると成功、出た瞬間に押す系は出る前に押せない', async () => {
  await fresh(2, 'g1'); await toTurnNoEv(p)
  const a = await p.evaluate(() => { HC.forceEvent('spill'); for (let i = 0; i < 6; i++) HC.choose(0); const mid = HC.G.ev.state; HC.choose(0); return { mid, end: HC.G.ev.state, ok: HC.G.ev.ok } })
  expect(a.mid === 'on' && a.end === 'done' && a.ok, JSON.stringify(a))
  await toTurnNoEv(p)
  const b = await p.evaluate(() => { HC.forceEvent('wallet'); const early = HC.choose(0); HC.dbg.step(50); const late = HC.choose(0); return { early, late, ok: HC.G.ev.ok } })
  expect(b.early === false && b.late === true && b.ok, JSON.stringify(b))
})
await t('[事件] しくじった事件はお詫び1万円ずつ、こぼしはクリーニング代、先輩は歩合を取られて明細に出る', async () => {
  await fresh(2, 'g1'); await toTurnNoEv(p)
  await p.evaluate(() => { HC.forceEvent('spill'); HC.dbg.step(Math.ceil(HC.state().left * 60) + 2) }); await toTurnNoEv(p)
  await p.evaluate(() => { HC.forceEvent('senpai'); HC.choose(HC.state().ev.opts.indexOf('stay')) }); await run(p, 200)
  const r = await p.evaluate(() => { HC.result(); return HC.G.result.ded.map(d => d.label + d.yen) }); expect(r.includes('事件のしくじり35000'), JSON.stringify(r)); return r
})
await t('[押し売り] 楽しませる前のボトルは失敗し売上0、2回で帰る', async () => {
  await fresh(3, 'g2'); await toTurnNoEv(p)
  const a = await p.evaluate(() => { HC.offerBottle(); const t = HC.G.tb; return { sales: t.spent, strikes: t.strikes, mood: t.mood } }); expect(a.sales === 0 && a.strikes === 1 && a.mood === 12, JSON.stringify(a))
  await toTurnNoEv(p); await p.evaluate(() => HC.offerBottle()); await run(p, 300)
  const c = await p.evaluate(() => HC.state()); expect(c.mode === 'end' && c.sales === 0 && c.rk === 'zero', JSON.stringify(c))
})
await t('[段階] ボトルは安い順に1本ずつ。メニューで押せるのは次の1本だけ', async () => {
  await fresh(3, 'g2'); await toTurnNoEv(p)
  const v = await p.evaluate(() => { const t = HC.G.tb; t.mood = 100; HC.openMenu(); const btn = [...document.querySelectorAll('#mItems .mi')].map(b => !b.disabled); HC.closeMenu(); HC.offerBottle(); return { btn, tier: t.tier, spent: t.spent } })
  expect(v.btn.join() === 'true,false,false,false' && v.tier === 1 && v.spent === 30000, JSON.stringify(v))
  await p.evaluate(() => HC.callEnd()); await toTurnNoEv(p)
  const w = await p.evaluate(() => { const t = HC.G.tb; t.mood = 50; HC.offerBottle(); return { tier: t.tier, strikes: t.strikes } }); expect(w.tier === 1 && w.strikes === 1, '2本目は楽しませてから ' + JSON.stringify(w))
})
await t('[財布] 財布を超える勧めは、その場で帰って指名も残らない', async () => {
  await fresh(3, 'x_tax'); await toTurnNoEv(p)
  const v = await p.evaluate(() => { const t = HC.G.tb; t.mood = 100; t.tier = 2; t.spent = 130000; HC.offerBottle(); return t.walletYen }); await run(p, 400)
  const s = await p.evaluate(() => HC.state()); expect(v === 150000 && s.mode === 'end' && !s.happy && s.sales === 130000, JSON.stringify(s))
})
await t('[色恋] 1回目は内勤が止めて会話が続き、2回目は営業停止', async () => {
  await fresh(2, 'g4'); await toTurnNoEv(p)
  const a = await p.evaluate(() => { HC.ura('love'); return HC.state() }); expect(a.mode === 'stop' && a.sales === 0 && a.warns === 1, JSON.stringify(a))
  await p.evaluate(() => HC.stopOk()); const s = await toTurnNoEv(p); expect(s.mode === 'play' && s.k === 'g4', 'continue ' + JSON.stringify(s))
  const b = await p.evaluate(() => { HC.ura('tsuke'); return HC.state() }); expect(b.mode === 'raid' && b.ended === 'raid', JSON.stringify(b))
  await p.evaluate(() => HC.result()); await run(p, 130); const c = await p.evaluate(() => HC.state()); expect(c.rk === 'raid' && c.net < 0, JSON.stringify(c))
})
await t('[色恋] 帳簿の人の前では1回で営業停止', async () => {
  await fresh(2, 'x_tax'); await toTurnNoEv(p); const a = await p.evaluate(() => { HC.ura('love'); return HC.state() }); expect(a.mode === 'raid', JSON.stringify(a))
})
await t('[未成年] 確かめずに売ると営業停止、身分証を見せてもらうと家まで送って見抜き手当', async () => {
  const s = await p.evaluate(() => { for (let s = 1; s < 400; s++) if (HC.buildPlay(s, 'x_young').minor) return s })
  await fresh(s, 'x_young'); await toTurnNoEv(p); const a = await p.evaluate(() => { HC.G.tb.mood = 90; HC.offerBottle(); return HC.state() }); expect(a.ended === 'raid', JSON.stringify(a))
  await fresh(s, 'x_young'); const st = await toTurnNoEv(p); expect(st.styles.includes('i'), JSON.stringify(st.styles))
  await p.evaluate(() => HC.choose(HC.state().styles.indexOf('i'))); await run(p, 400); const b = await p.evaluate(() => HC.state()); expect(b.minors === 1 && b.rk === 'catch' && b.net > 0, JSON.stringify(b))
  const adult = await p.evaluate(() => { for (let s = 1; s < 400; s++) if (!HC.buildPlay(s, 'x_young').minor) return s })
  await fresh(adult, 'x_young'); await toTurnNoEv(p); await p.evaluate(() => { HC.openMenu(); document.querySelector('#mId').click() }); const c = await toTurnNoEv(p); expect(c.mode === 'play' && c.checked && c.kind === 'hello', 'menu id ' + JSON.stringify(c))
})
await t('[何もしない] 黙っていると3回で帰り、売上0でクビ', async () => {
  await fresh(1, 'g6'); for (let i = 0; i < 80; i++) await run(p, 60); const s = await p.evaluate(() => HC.state()); expect(s.mode === 'end' && s.sales === 0 && s.rk === 'zero' && s.silent === 3, JSON.stringify(s))
})
await t('[通し] 本音を読み、事件をさばき、勧めどきに勧めると、財布の底まで使って笑って帰る', async () => {
  await fresh(1, 'g2'); let g = 0
  for (; g < 3000; g++) {
    const s = await p.evaluate(() => { HC.dbg.step(30); return HC.state() })
    if (s.mode === 'end') break
    if (s.mode === 'event' && s.ev.state === 'on') await p.evaluate(() => { const s = HC.state(); if (s.ev.kind === 'two') HC.choose(s.ev.opts.indexOf(HC.evCorrect(HC.G.ev, HC.G.tb))); else if (s.ev.shown) for (let i = 0; i < 9; i++) HC.choose(0) })
    if (s.mode === 'play' && s.phase === 'turn') await p.evaluate(() => { const s = HC.state(); if (s.ready) return HC.offerBottle(); HC.choose(s.grades.indexOf('H')) })
  }
  await run(p, 200); const r = await p.evaluate(() => HC.state())
  expect(r.mode === 'end' && r.sales === 1440000 && r.rk === 'legend' && r.bottles === 4 && r.evOk === r.evAll && r.evAll >= 2, JSON.stringify(r)); const v = await variance(p, '#slip'); expect(v > 100, 'slip ' + v)
  const head = await p.evaluate(() => document.querySelector('#endLabel').textContent + ' ' + document.querySelector('#endSales').textContent)
  expect(head === 'レイナ姫の会計 ¥1,440,000', head)
  const slip = await p.evaluate(() => HC.G.result.pay.map(x => x.label + ':' + x.note))
  expect(slip.some(x => x.startsWith('事件対応手当:')), JSON.stringify(slip))
  return { sales: r.sales, rk: r.rk, ex: r.ex, ev: `${r.evOk}/${r.evAll}`, head }
})
await t('[結果] Xの文に事件と無言の回数が入る', async () => {
  const s = await p.evaluate(() => { const u = HC.D.UI.ja, r = HC.G.result; return u.shareText(r.who, r.spent, HC.G.bottles, u.rankName[r.rk], r.evOk, r.evAll, r.silent) })
  expect(/事件\d\/\d件さばいて無言\d回/.test(s), s); return s
})
await t('[判定] 発表までハンコを出さない（stampK が 0 から 1 へ）', async () => {
  await fresh(1, 'g1'); await toTurnNoEv(p); await p.evaluate(() => { HC.result() }); const a = await p.evaluate(() => HC.G.result.stampK); await run(p, 200); const b = await p.evaluate(() => HC.G.result.stampK); expect(a === 0 && b === 1, JSON.stringify([a, b]))
})
await t('[TM] 開始・終了・シェアが記録される', async () => {
  const r = await p.evaluate(() => { HC.start(1, { skipIntro: true }); TM.share('x'); HC.result(); return window.__tmLog.map(x => x.name) }); expect(r.includes('game_start') && r.includes('share'), JSON.stringify(r))
})
await t('[音] 効果音は呼ばれる（事件の音も録音素材）。実際には無音', async () => {
  const r = await p.evaluate(() => ({ played: Object.keys(HC.Snd.played), ok: window.__muteOk(), st: HC.Snd.ctx ? HC.Snd.ctx.state : 'none' })); expect(r.played.length >= 5 && r.played.some(k => k.startsWith('ev_')) && r.ok && r.st !== 'running', JSON.stringify(r)); return r.played.filter(k => k.startsWith('ev_')).join(',')
})
await t('英語の通し: 全部の文字が英語に切り替わる', async () => {
  await p.evaluate(() => { HC.setLang('en'); HC.start(2, { skipIntro: true, guest: 'g5' }) }); await toTurnNoEv(p)
  const r = await p.evaluate(() => { HC.openMenu(); const t = [...document.querySelectorAll('.card,#clue,#bubble,#menu span,#menu h3,#menu small,#mBack,#tBottle,#hTable,#hNoms')].map(e => e.textContent).join(' '); HC.closeMenu(); return t })
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(r), r)
  const e = await p.evaluate(() => { HC.forceEvent('ex', 'gf'); const t = [...document.querySelectorAll('.card,#clue,#bubble')].map(e => e.textContent).join(' '); HC.choose(0); HC.dbg.step(200); return t }); expect(!/[ぁ-んァ-ヶ一-龠]/.test(e), e)
  await toTurnNoEv(p); await p.evaluate(() => { HC.ura('love') }); await p.evaluate(() => HC.stopOk()); await toTurnNoEv(p); await p.evaluate(() => HC.ura('love')); await run(p, 150); const raid = await p.evaluate(() => document.querySelector('#raidText').textContent + document.querySelector('#raidStamp').textContent)
  expect(!/[ぁ-んァ-ヶ一-龠]/.test(raid), raid)
  await p.evaluate(() => { HC.result() }); await run(p, 130); const end = await p.evaluate(() => document.querySelector('#endLabel').textContent + document.querySelector('#bAgain').textContent + document.querySelector('#bSave').textContent + document.querySelector('#bPost').textContent + (document.querySelector('#tmSupport') || {}).textContent); expect(!/[ぁ-んァ-ヶ一-龠]/.test(end), end)
  await p.evaluate(() => HC.setLang('ja'))
})
await t('データの英語に日本語なし', async () => {
  const r = await p.evaluate(() => { const bad = []; const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.ja === 'string' && typeof o.en === 'string' && /[ぁ-んァ-ヶ一-龠]/.test(o.en)) bad.push(o.en); for (const k in o) walk(o[k]) }; for (const k in HC.D) if (k !== 'UI') walk(HC.D[k]); walk(HC.T); return bad })
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
