// 一晩だけホスト 本体。1プレイ＝客1人。客の一言に3択で返し、楽しませてからボトルを安い順に勧める
// v3: 客の本音（聞く・笑い・褒め・気遣い・そっと）は毎回くじ。台詞は客同士で共通なので、当たりは卓の持ち物としぐさを読まないと分からない
//     返事には制限時間（グラスの泡が消えるまで）。会話の途中にくじで事件が割り込む
// 描画は Canvas 2D、時間は固定60Hz（performance.now で数える）
import { drawPayslip, totals } from './payslip.js?v=5'
window.__jsUp = true
const D = window.HD, T = window.HT
const $ = s => document.querySelector(s)
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
let lang = store.get('jh_lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const L = () => D.UI[lang]
const tx = o => (o ? (o[lang] ?? o.ja) : '')
const yen = n => '¥' + Math.round(n).toLocaleString('en-US')
const len = s => [...s].length
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---------- 釣り合いの数字（sim.mjs で確かめる）
// 返事の制限時間 = max(ボトルの段ごとの基準, 読む時間) 。読む時間 = 2.5秒 + 一言1字0.15秒 + 3択1字0.07秒（2026-11-07 本人「時間制限早すぎ」で約1.6〜2倍に）
export const NUM = {
  START: 30, HIT: 14, MISS: -12, SILENT: -14, SIL_OUT: 3, PUSH: -18, SOLD: -10, STOP: -20, ID_OK: 14, NOMI_FEE: 10000, MAXEX: 12,
  TURN: [11, 10, 9, 8.5, 8], READ0: 2.5, READ_LINE: 0.15, READ_OPT: 0.07, HELLO_PLUS: 1.5, ROOKIE_PLUS: 2,
  EV_TWO: 3.4, EV_MASH: 3.8, EV_QUICK: 1.8, EV_PAY: 10000, EV_FINE: 10000, SIL_FINE: 1000,
  HAPPY: 60, WARN: 10000, RAID: 1000000, MINOR: 5000, NOMI: 3000, PER_BOTTLE: 1000, COMM: 0.2,
}

// ---------- 画像
const V = '?v=5'
const IMG = {}
const ITEMS = ['mirror', 'lipstick', 'brooch', 'medicine', 'phone', 'papers', 'fish', 'nose', 'ticket', 'book', 'earbuds', 'readers', 'ledger', 'cards', 'coupons', 'pass']
// 最初の画面に要る物だけ待つ。コールの絵や事件の人物は準備完了のあと裏で読む
const FIRST = ['bg', 's_senpai', 'b1']
const LATER = ['s_boss', 'crew', 's_naikin', 'b2', 'b3', 'tower', 'e_ex', 'e_pizza', 'x_mom', 'x_oji', 'i_purse', ...ITEMS.map(n => 'i_' + n)]
const loadImg = n => new Promise(res => { if (IMG[n]) return res(); const im = new Image(); im.onload = () => { IMG[n] = im; res() }; im.onerror = () => { console.error('img ' + n); res() }; im.src = 'img/' + n + '.webp' + V })
const HAS = new Set(['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].flatMap(k => [k, k + '_h', k + '_c']).concat(['x_tax', 'x_tax_c', 'x_oba', 'x_oba_h', 'x_oba_c', 'x_mom', 'x_mom_h', 'x_oji', 'x_oji_h', 'x_young', 'x_young_h']))
const faces = g => [g.k, g.k + '_h', g.k + '_c'].filter(n => HAS.has(n))

// ---------- 場面の座標（背景 1536x1024、人物は 640x960 に縮めてあるが 896x1344 のつもりで置く）
const SW = 1536, SH = 1024, CY = 784, CS = 0.62, IW = 896, IH = 1344
// 卓の上: 本音の持ち物2つ・財布か目印・グラス（スマホ縦で見える 470〜1070 の中）
const SPOT = [{ x: 530, y: 905, h: 100 }, { x: 672, y: 925, h: 100 }, { x: 815, y: 930, h: 86 }]
const GLASS = { x: 985, y: 930, h: 230 }

// ---------- 状態
const G = { mode: 'title', t: 0, tasks: [], tb: null, ended: null, seed: 1, snap: null, log: [], flash: 0, mom: false, callAt: 0, bottles: 0, warns: 0, minors: 0 }
const later = (d, fn) => G.tasks.push({ at: G.t + d, fn, night: G.gen })
const sayMin = s => Math.max(1.6, 0.9 + 0.09 * len(s))
const byKey = Object.fromEntries(T.GUESTS.map(g => [g.k, g]))
const lineOf = (t, k) => (t.g.lines && t.g.lines[k]) || D.LINE[k]
const hasW = (o, w) => o.w.includes(w)

// ---------- 1回のくじ。同じ種なら同じ客・同じ本音・同じ持ち物・同じ話題順・同じ事件
function pickItems(want, r, avoid = []) {
  const pool = Object.keys(T.ITEMS).filter(k => hasW(T.ITEMS[k], want) && !avoid.includes(k))
  const a = []; while (a.length < 2 && pool.length) a.push(pool.splice((r() * pool.length) | 0, 1)[0])
  return a
}
function buildPlay(seed, guestKey, opts = {}) {
  const r = rng(seed), shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a }, pick = a => a[(r() * a.length) | 0]
  let g = byKey[guestKey]
  if (!g) { const ks = Object.keys(T.WEIGHT), sum = ks.reduce((a, k) => a + T.WEIGHT[k], 0); let x = r() * sum; for (const k of ks) { x -= T.WEIGHT[k]; if (x <= 0) { g = byKey[k]; break } } g = g || byKey.g1 }
  else r()
  const wallet = pick(g.wallets), w = D.WALLET[wallet]
  const want = opts.want || pick(g.wants)
  const items = pickItems(want, r)
  const want2 = g.turn ? pick(g.wants.filter(x => x !== want)) : null
  // 事件: 2〜3回。くじで種類と順番。たまにレア
  const okEv = k => !(D.EVENTS[k].noGuest || []).includes(g.k)
  const normal = Object.keys(D.EVENTS).filter(k => !D.EVENTS[k].rare && okEv(k)), rare = Object.keys(D.EVENTS).filter(k => D.EVENTS[k].rare && okEv(k))
  const n = 2 + (r() < 0.6 ? 1 : 0), evs = shuffle(normal).slice(0, n)
  if (r() < 0.2 && rare.length) evs[(r() * n) | 0] = pick(rare)
  const slots = n === 3 ? [2, 5 + (r() < .5 ? 0 : 1), 8] : [2 + (r() < .5 ? 0 : 1), 6 + (r() < .5 ? 0 : 1)]
  const evQ = evs.map((k, i) => { const E = D.EVENTS[k]; return { k, at: slots[i], cue: E.cues ? pick(E.cues) : null, delay: 0.5 + r() * 0.6, done: false } })
  const t = {
    g, gag: g.gag || null, want, want0: want, want2, switchAt: g.turn ? 5 : null, switched: false, items, extra: g.extra || null,
    wallet, walletYen: w.yen, walletItem: w.i && !g.extra ? w.i : null,
    hello: pick(T.HELLO), close: pick(T.CLOSE), topics: shuffle(T.TOPICS), minor: g.gag === 'young' ? r() < 0.5 : false, r, evQ, gest0: (r() * 14) | 0,
    mood: NUM.START, spent: 0, tier: 0, strikes: 0, sil: 0, ex: 0, hits: 0, misses: 0, checked: false, happy: false,
    state: 'wait', node: null, kind: null, choices: null, ti: null, si: 0, said: false, curGest: null, away: false,
  }
  t.shuffle = shuffle
  return t
}
// 財布で買える段の数（安い順に足していって届く所まで）
function affordable(t) { let s = 0, n = 0; for (const b of D.BOTTLE) { if (s + b.yen > t.walletYen) break; s += b.yen; n++ } return n }

// ---------- 画面
function show(v) { for (const id of ['vTitle', 'vPlay', 'vEnd']) $('#' + id).hidden = id !== v; layout() }
function startNight(seed, opts = {}) {
  ambOn(); hideAll()
  G.gen = (G.gen || 0) + 1
  G.seed = seed ?? ((Math.random() * 1e9) | 0)
  const t = buildPlay(G.seed, opts.guest, opts)
  Object.assign(G, { tb: t, ended: null, snap: null, log: [], tasks: [], mom: false, bottles: 0, warns: 0, minors: 0, callState: null, menuOpen: false, count: null, stampAt: null, result: null, total: null, raidKind: null, ev: null, evVis: null, evAll: 0, evOk: 0, evCost: 0, evFail: 0, tips: 0, silent: 0, clock: null })
  G.rookie = store.get('jh_played') !== '1'
  for (const n of faces(t.g)) loadImg(n)
  if (!$('#callCrew').getAttribute('src')) $('#callCrew').src = 'img/crew.webp' + V
  window.TM && TM.start()
  updateHud(); show('vPlay'); setCards(null)
  if (opts.skipIntro) { seat(); return }
  G.mode = 'intro'
  G.introI = 0; $('#sayImg').src = 'img/s_boss.webp' + V; $('#sayNm').textContent = L().boss; sayLine(); $('#say').hidden = false
}
function sayLine() { $('#sayLine').textContent = L().intro[G.introI] }
function introNext() { Sfx('card'); G.introI++; if (G.introI >= L().intro.length) introEnd(); else sayLine() }
function introEnd() { if (G.mode !== 'intro') return; $('#say').hidden = true; seat() }
function hideAll() { for (const id of ['#menu', '#call', '#stop', '#raid', '#say', '#how']) $(id).hidden = true; hideBubble(); hideClue() }

function seat() {
  const t = G.tb; G.mode = 'play'; t.state = 'enter'; t.enterAt = G.t; t.leaveAt = null; t.reactFx = null
  updateHud(); Sfx('card')
  later(0.8, () => { if (G.tb === t) present(t.hello, 'hello') })
}
// 3択: 本音の返事＋ほかの型から2つ。童顔の人の最初の一言だけ、1つが身分証
function makeChoices(t, node, kind) {
  const hit = node.o.find(o => o.st === t.want), rest = t.shuffle(node.o.filter(o => o.st !== t.want)).slice(0, 2)
  if (kind === 'hello' && t.gag === 'young' && !t.checked) rest[1] = T.ID_OPT
  return t.shuffle([hit, ...rest])
}
function turnLimit(t, node) {
  const lineRead = t.g.speech === 'hoh' ? len(tx(node.s)) + 4 : len(tx(node.s))
  const opts = t.choices.reduce((a, c) => a + len(tx(c.t)), 0)
  const read = NUM.READ0 + NUM.READ_LINE * lineRead + NUM.READ_OPT * opts
  return Math.max(NUM.TURN[Math.min(t.tier, 4)], read) + (t.kind === 'hello' ? NUM.HELLO_PLUS : 0) + (G.rookie ? NUM.ROOKIE_PLUS : 0)
}
// 客の一言を出して、3択を並べる。again はボトルや内勤のあとに同じ一言へ戻る時
function present(node, kind, again) {
  const t = G.tb; if (!t || t.state === 'gone') return
  t.node = node; t.kind = kind; t.state = 'turn'
  if (!again || !t.choices) t.choices = makeChoices(t, node, kind)
  t.limit = turnLimit(t, node); t.deadline = G.t + t.limit; G.clock = { t0: G.t, t1: t.deadline }
  setCards(t.choices); refreshBottle()
  // しぐさ。本音を指すものから、往復ごとに違う一行。変わり目は酔った合図
  const gs = T.GEST.filter(x => hasW(x, t.want)); t.curGest = gs[(t.gest0 + t.ex) % gs.length]
  if (t.g.speech === 'hoh') {
    say(tx(T.HOH.line[(t.ex + t.gest0) % T.HOH.line.length])); setClue(`${tx(T.HOH.tr)}「${tx(node.s)}」`, 'tr')
  } else {
    say(tx(node.s))
    if (t.switchNow) { t.switchNow = false; setClue(tx(T.SWITCH), 'tip') }
    else if (kind === 'hello' && store.get('jh_tut_i') !== '1') { store.set('jh_tut_i', '1'); setClue(L().tut.items, 'tip') }
    else if (store.get('jh_tut') !== '1' && bottleReady(t)) { store.set('jh_tut', '1'); setClue(L().tut.bottle, 'tip') }
    else setClue(tx(t.curGest))
  }
  updateHud()
}
const attKey = m => m < 25 ? 'low' : m < 45 ? 'mid' : m < 60 ? 'warm' : m < 85 ? 'lean' : 'full'
const bottleReady = t => t.tier < D.BOTTLE.length && t.mood >= D.BOTTLE[t.tier].need

// ---------- 会話を選ぶ
function choose(i) {
  if (G.mode === 'event') return evChoose(i)
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return false
  const c = t.choices[i]; if (!c) return false
  t.state = 'react'; setCards(t.choices, true); refreshBottle(); G.clock = null
  if (c.st === 'i') return idCheck(t, true)
  const hit = c.st === t.want
  setMood(t, hit ? NUM.HIT : NUM.MISS); t.sil = 0; hit ? t.hits++ : t.misses++
  G.log.push(`${t.g.k}:${t.kind}:${c.st}:${hit ? 'H' : 'M'}`)
  const cold = T.COLD[t.want]
  react(t, hit ? c.r : cold[(t.misses + t.ex) % cold.length], hit ? 'h' : 'c', advance)
  return true
}
function react(t, line, face, then) {
  t.reactFx = { kind: face, at: G.t }
  if (face === 'h') Sfx('good'); else if (face === 'c') { t.shake = G.t; Sfx('bad') }
  let s = tx(line)
  if (t.g.speech === 'hoh') { say(tx(face === 'h' ? T.HOH.hit : T.HOH.cold)); setClue(`${tx(T.HOH.tr)}「${s}」`, 'tr') } else { say(s); hideClue() }
  later(sayMin(s), () => { if (G.tb === t && t.state !== 'gone') then() })
}
function setMood(t, d) { t.mood = Math.max(0, Math.min(100, t.mood + d)); refreshBottle() }
const leaving = t => t.mood <= 0 || t.strikes >= 2 || t.sil >= NUM.SIL_OUT
function advance() {
  const t = G.tb; if (!t || t.state === 'gone') return
  t.ex++
  if (leaving(t) || t.kind === 'close') return leave()
  // 途中で本音が変わる客。持ち物が入れ替わり、しぐさの行で合図
  if (t.switchAt != null && !t.switched && t.ex >= t.switchAt) { t.switched = true; t.want = t.want2; t.items = pickItems(t.want, t.r, t.items); t.itemsAt = G.t; t.switchNow = true; G.log.push(`${t.g.k}:switch:${t.want}`) }
  const e = t.evQ.find(e => !e.done && t.ex >= e.at)
  if (e && t.ex < NUM.MAXEX - 1) { e.done = true; return startEvent(e) }
  next()
}
function next() {
  const t = G.tb
  if (t.ex >= NUM.MAXEX - 1) return present(t.close, 'close')
  if (t.kind === 'topic' && t.si + 1 < t.ti.length) { t.si++; return present(t.ti[t.si], 'topic') }
  if (!t.topics.length) return present(t.close, 'close')
  t.ti = t.topics.shift(); t.si = 0; present(t.ti[0], 'topic')
}
function silence() {
  const t = G.tb; t.state = 'react'; setCards(t.choices, true); t.sil++; G.silent++; setMood(t, NUM.SILENT); G.log.push(t.g.k + ':silent'); G.clock = null
  const a = lineOf(t, 'silent'); react(t, Array.isArray(a) ? a[G.silent % a.length] : a, 'c', advance)
}
function idCheck(t, asReply) {
  t.checked = true; G.log.push(t.g.k + ':id'); G.clock = null
  if (t.minor) {
    G.minors++; t.state = 'react'; const s = tx(t.g.lines.idNG); say(s); t.reactFx = { kind: 'c', at: G.t, hold: true }; setClue(L().minorSent); setCards(t.choices, true); refreshBottle()
    later(Math.max(2.2, sayMin(s)), () => { if (G.tb !== t) return; t.state = 'gone'; t.leaveAt = G.t; G.ended = 'catch'; later(0.8, () => { if (G.tb === t) goResult() }) })
  } else {
    setMood(t, NUM.ID_OK); Sfx('good'); t.state = 'react'; setCards(t.choices, true)
    react(t, t.g.lines.idOK, 'h', () => asReply ? advance() : present(t.node, t.kind, true))
  }
  return true
}

// ---------- 事件（会話の途中にくじで割り込む）
const evCorrect = (ev, t) => ev.cue ? ev.cue.ok : ev.E.ok === 'want' ? (ev.E.okWant[t.want] || ev.E.okElse) : ev.E.ok
function startEvent(e) {
  const t = G.tb, E = D.EVENTS[e.k]
  G.mode = 'event'; G.evAll++; G.log.push(`${t.g.k}:ev:${e.k}`)
  const ev = G.ev = { ...e, E, at: G.t, taps: 0, shown: E.kind !== 'quick', state: 'on', order: t.shuffle(E.opts.map((_, i) => i)) }
  if (E.img) G.evVis = { img: E.img, at: G.t, out: null }
  if (E.who === 'none') { t.away = true; t.awayAt = G.t }
  Sfx('ev_' + e.k)
  const line = tx(E.line).replace('{n}', honName(t))
  if (E.who === 'guest' && t.g.speech === 'hoh') { say(tx(T.HOH.line[2])); setClue(`${tx(T.HOH.tr)}「${line}」`, 'tr') }
  else { say(line, E.who === 'them' ? 'them' : ''); if (e.cue) setClue(tx(e.cue), 'tip'); else hideClue() }
  let lim
  if (E.kind === 'two') lim = Math.max(NUM.EV_TWO, NUM.READ0 + NUM.READ_LINE * (len(line) + (e.cue ? len(tx(e.cue)) : 0)) + 0.04 * E.opts.reduce((a, o) => a + len(tx(o)), 0))
  else if (E.kind === 'mash') lim = NUM.EV_MASH
  else lim = e.delay + NUM.EV_QUICK
  lim += G.rookie ? 1 : 0
  ev.t1 = G.t + lim; G.clock = { t0: G.t, t1: ev.t1 }
  setEvCards()
}
function setEvCards() {
  const ev = G.ev, box = $('#cards'); if (!box.children.length) setCards(null)
  ;[...box.children].forEach((b, i) => {
    let s = ' ', on = false
    if (ev.state === 'on') {
      if (ev.E.kind === 'two' && i < ev.order.length) { s = tx(ev.E.opts[ev.order[i]]); on = true }
      else if (ev.E.kind === 'mash' && i === 0) { s = `${tx(ev.E.opts[0])}  ${L().left(Math.max(0, ev.E.need - ev.taps))}`; on = true }
      else if (ev.E.kind === 'quick' && i === 0 && ev.shown) { s = tx(ev.E.opts[0]); on = true }
    }
    b.textContent = s; b.disabled = !on; b.className = 'card' + (on ? ' ev' : ev.state === 'on' ? ' off' : '')
  })
  refreshBottle(); layout()
}
function evChoose(i) {
  const ev = G.ev, t = G.tb; if (!ev || ev.state !== 'on') return false
  if (ev.E.kind === 'mash') { if (i !== 0) return false; ev.taps++; Sfx('wipe'); if (ev.taps >= ev.E.need) evResolve(true, 'wipe'); else setEvCards(); return true }
  if (ev.E.kind === 'quick') { if (i !== 0 || !ev.shown) return false; evResolve(true, 'pick'); return true }
  const o = ev.E.opts[ev.order[i]]; if (!o) return false
  evResolve(o.k === evCorrect(ev, t), o.k); return true
}
function evResolve(ok, k) {
  const ev = G.ev, t = G.tb, E = ev.E; ev.state = 'done'; ev.ok = ok; G.clock = null; setEvCards()
  G.log.push(`${t.g.k}:ev:${ev.k}:${ok ? 'ok' : k || 'timeout'}`)
  if (t.away) { t.away = false; t.enterAt = G.t }
  let line
  if (ok) {
    G.evOk++; setMood(t, E.mood[0]); line = E.win.ja ? E.win : E.win[k]
    if (E.tip) { G.tips += E.tip; Sfx('coins') }
    if (ev.k === 'photo') { Sfx('shutter'); G.flash = 1 }
  } else {
    setMood(t, E.mood[1]); line = E.lose; G.evFail = (G.evFail || 0) + 1
    G.evCost += NUM.EV_FINE + (E.cost || 0)
  }
  if (G.evVis && !(ok && ev.k === 'hoh')) G.evVis.out = G.t + 0.2
  t.reactFx = { kind: ok ? 'h' : 'c', at: G.t }
  if (ok) Sfx('evok'); else { t.shake = G.t; Sfx('bad') }
  const s = tx(line)
  if (t.g.speech === 'hoh' && !(ev.k === 'hoh' && ok)) { say(tx(ok ? T.HOH.hit : T.HOH.cold)); setClue(`${tx(T.HOH.tr)}「${s}」`, 'tr') }
  else { say(s, ev.k === 'hoh' && ok ? 'them' : ''); hideClue() }
  updateHud()
  later(sayMin(s) + 0.2, () => {
    if (G.tb !== t || G.ev !== ev) return
    if (G.evVis) G.evVis.out = G.evVis.out ?? G.t
    G.ev = null; G.mode = 'play'
    if (leaving(t)) leave(); else next()
  })
}

// ---------- ボトル（安い順に1本ずつ）
function offerBottle() {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn' || t.tier >= D.BOTTLE.length) return false
  closeMenu(); t.state = 'react'; setCards(t.choices, true); refreshBottle(); G.clock = null
  const n = t.tier, b = D.BOTTLE[n]; G.log.push(`${t.g.k}:bottle${n}`)
  if (t.gag === 'young' && t.minor && !t.checked) return raid('minor')
  // 楽しさを渡す前の「買って」は押し売り。2回で帰る
  const push = line => { setMood(t, NUM.PUSH); t.strikes++; react(t, t.strikes >= 2 ? lineOf(t, 'early2') : line, 'c', () => leaving(t) ? leave() : present(t.node, t.kind, true)) }
  if (t.mood < b.need) { push(lineOf(t, 'early')); return true }
  // 財布を超える勧めは、その場で帰る（財布を見ていない）
  if (b.yen > t.walletYen - t.spent) { t.offended = true; setMood(t, NUM.PUSH); react(t, lineOf(t, 'over'), 'c', () => leave()); return true }
  // 売れた
  t.spent += b.yen; t.tier++; G.bottles++; setMood(t, NUM.SOLD); updateHud()
  if (t.gag === 'mom') G.mom = true
  t.reactFx = { kind: 'h', at: G.t }
  const nb = D.BOTTLE[t.tier], end = !nb || t.spent + nb.yen > t.walletYen
  const buy = lineOf(t, 'buy'), s = end && t.tier < D.BOTTLE.length ? lineOf(t, 'last') : buy[(G.bottles + t.ex) % buy.length]
  t.said = end; say(tx(s)); hideClue()
  later(Math.max(1.2, sayMin(tx(s)) * 0.7), () => { if (G.tb === t) champagneCall(n, t) })
  return true
}
function ura(kind) {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return false
  closeMenu(); t.state = 'react'; setCards(t.choices, true); refreshBottle(); G.log.push(`${t.g.k}:${kind}`); G.clock = null
  G.warns++
  if (G.warns >= 2) { raid(kind); return true }
  if (t.gag === 'tax') { raid('tax'); return true }
  stopScene(kind === 'love' ? L().stopLove : L().stopTsuke, 's_naikin', `${L().stopFine} -${yen(NUM.WARN)}`, 'run', () => {
    setMood(t, NUM.STOP); react(t, lineOf(t, 'afterStop'), 'c', () => leaving(t) ? leave() : present(t.node, t.kind, true))
  })
  return true
}
function stopScene(line, img, fine, sfx, after) {
  G.mode = 'stop'; hideBubble(); hideClue(); Sfx(sfx)
  $('#stopImg').src = 'img/' + img + '.webp' + V; const im = $('#stopImg'); im.classList.add('far'); requestAnimationFrame(() => im.classList.remove('far'))
  $('#stopLine').textContent = line; $('#stopFine').textContent = fine; $('#bStopOk').textContent = L().stopOk; $('#stop').hidden = false
  G.stopAfter = after
}
function stopOk() { if (G.mode !== 'stop') return; $('#stop').hidden = true; G.mode = 'play'; const f = G.stopAfter; G.stopAfter = null; f && f() }
function raid(kind) {
  const u = L(); G.ended = 'raid'; G.mode = 'raid'; G.raidKind = kind; hideBubble(); hideClue(); setCards(null); closeMenu(); G.clock = null
  Sfx('siren')
  $('#raidText').textContent = { love: u.raidLove, tsuke: u.raidTsuke, minor: u.raidMinor, tax: u.raidTax }[kind]
  const st = $('#raidStamp'); st.textContent = u.raidStamp; st.style.fontSize = u.raidStamp.length > 4 ? 'min(12vw,8vh,64px)' : ''; st.classList.remove('in'); $('#bRaid').textContent = u.toSlip; $('#bRaid').hidden = true; $('#raid').hidden = false
  later(1.6, () => { st.classList.add('in'); Sfx('stamp') })
  later(2.3, () => { $('#bRaid').hidden = false })
  window.TM && TM.end(0, false)
  return true
}

// ---------- シャンパンコール（ここが見せ場）
const fxc = $('#fx'), fx = fxc.getContext('2d')
let confetti = []
function burst(n) { const W = fxc.width, H = fxc.height, C = ['#f4dc9a', '#d9b45f', '#8c1f33', '#fff', '#d8352a']; for (let i = 0; i < n && confetti.length < 260; i++) confetti.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - .5) * 1.4, vy: 1.6 + Math.random() * 3.2, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, s: 5 + Math.random() * 9, c: C[(Math.random() * C.length) | 0] }) }
const honName = t => tx(t.g.name) + tx(t.g.hon)
function champagneCall(n, t) {
  const who = honName(t)
  const pool = D.CALL.mid.slice(1), k = G.seed + G.bottles * 3
  const lines = n === 3 ? [D.CALL.tower[0], { ja: D.CALL.mid[0].ja.replace('{n}', who), en: D.CALL.mid[0].en.replace('{n}', who) }, D.CALL.tower[1], D.CALL.tower[2]]
    : [D.CALL.open[0], { ja: D.CALL.mid[0].ja.replace('{n}', who), en: D.CALL.mid[0].en.replace('{n}', who) }, pool[k % pool.length]]
  if (n === 1 || n === 2) lines.push(pool[(k + 4) % pool.length])
  if (n === 2) lines.push(pool[(k + 7) % pool.length])
  lines.push(D.CALL.last[0])
  // コールのあとは同じ一言に戻る（泡は注ぎ直し）
  runCall({ img: D.BOTTLE[n].i, sub: `+${yen(D.BOTTLE[n].yen)}`, lines, big: n }, () => { if (G.tb !== t) return; present(t.node, t.kind, true) })
  takeSnap(t, n)
}
function runCall(o, after) {
  G.mode = 'call'; hideBubble(); hideClue(); setCards(null, true); G.callAfter = after; G.callAt = G.t; G.callDone = false
  const u = $('#call'); u.hidden = false; resizeFx(); confetti = []; burst(120 + o.big * 60)
  $('#callItem').src = 'img/' + o.img + '.webp' + V; const it = $('#callItem'), crew = $('#callCrew'), big = $('#callBig')
  it.classList.remove('in'); crew.classList.remove('in', 'bob'); big.textContent = ''; $('#callSub').textContent = o.sub
  requestAnimationFrame(() => it.classList.add('in'))
  Sfx('sold'); Hype(true); G.flash = 1
  const callId = (G.callId = (G.callId || 0) + 1)
  later(0.35, () => { if (G.callId === callId) { crew.classList.add('in'); later(0.5, () => { if (G.callId === callId) crew.classList.add('bob') }) } })
  o.lines.forEach((l, i) => later(0.5 + i * 1.25, () => {
    if (G.callId !== callId || G.callDone) return
    big.textContent = tx(l); big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); burst(40 + o.big * 20); Sfx('good')
  }))
  G.callEndAt = G.t + 0.5 + o.lines.length * 1.25 + 0.4
}
function callEnd() {
  if (G.mode !== 'call' || G.callDone) return; G.callDone = true; G.callId++
  $('#call').hidden = true; Hype(false); confetti = []
  const f = G.callAfter; G.callAfter = null; G.mode = 'play'; f && f()
}
function resizeFx() { fxc.width = Math.max(1, Math.round(innerWidth)); fxc.height = Math.max(1, Math.round(innerHeight)) }
function drawFx() {
  if ($('#call').hidden) return
  const W = fxc.width, H = fxc.height; fx.clearRect(0, 0, W, H)
  const a = G.t - G.callAt
  for (let i = 0; i < 5; i++) {
    const sw = Math.sin(a * (0.9 + i * .23) + i * 1.7), x = W * (0.1 + i * .2), tx0 = x + sw * W * 0.34
    const gr = fx.createLinearGradient(x, -10, tx0, H); gr.addColorStop(0, `rgba(255,220,140,${.34 - i * .02})`); gr.addColorStop(1, 'rgba(255,200,120,0)')
    fx.fillStyle = gr; fx.beginPath(); fx.moveTo(x - 8, -10); fx.lineTo(x + 8, -10); fx.lineTo(tx0 + W * .16, H); fx.lineTo(tx0 - W * .16, H); fx.closePath(); fx.fill()
  }
  if (G.flash > 0.01) { fx.fillStyle = `rgba(255,240,200,${G.flash * .75})`; fx.fillRect(0, 0, W, H) }
  for (const c of confetti) { fx.save(); fx.translate(c.x, c.y); fx.rotate(c.r); fx.fillStyle = c.c; fx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); fx.restore() }
}

// ---------- お帰り
function leave() {
  const t = G.tb; if (!t || t.state === 'gone') return
  t.state = 'gone'; setCards(null, true); refreshBottle(); hideClue(); G.clock = null
  t.happy = t.mood >= NUM.HAPPY && !t.offended
  const s = tx(lineOf(t, t.happy ? 'good' : t.mood < 25 || t.offended ? 'bad' : 'ok'))
  say(s); t.reactFx = { kind: t.happy ? 'h' : t.mood < 25 || t.offended ? 'c' : 'n', at: G.t, hold: true }
  // 楽しく帰る客は、次も指名すると言って指名料を払っていく
  if (t.happy) { t.spent += NUM.NOMI_FEE; updateHud(); setClue(`${L().nomiFee} +${yen(NUM.NOMI_FEE)}`); Sfx('coins') }
  t.leaveAt = G.t + sayMin(s) - 0.4
  later(sayMin(s) + 0.3, () => { if (G.tb === t) goResult() })
}
function goResult() { G.ended = G.ended || 'close'; window.TM && TM.end(G.tb ? G.tb.spent : 0, true); result() }

// ---------- 結果
function rankOf(t) {
  if (G.ended === 'raid') return 'raid'
  if (G.ended === 'catch') return 'catch'
  const A = affordable(t), n = t.tier
  if (!n) return 'zero'
  if (n >= A) return t.happy ? 'legend' : 'top'
  return n >= A - 1 ? 'mid' : 'low'
}
function buildSlip() {
  const u = L(), t = G.tb, raided = G.ended === 'raid', rk = rankOf(t), who = honName(t)
  const pay = [], ded = []
  pay.push({ label: u.payComm, note: u.note(who, t.spent), yen: raided ? 0 : Math.round(t.spent * NUM.COMM) })
  if (t.happy && !raided) pay.push({ label: u.payNomi, note: `1${u.unitN}`, yen: NUM.NOMI })
  if (G.bottles) pay.push({ label: u.payBottle, note: `${G.bottles}${u.unitN}`, yen: raided ? 0 : G.bottles * NUM.PER_BOTTLE })
  if (G.evAll) pay.push({ label: u.payEv, note: u.evNote(G.evOk, G.evAll), yen: G.evOk * NUM.EV_PAY + (G.tips || 0) })
  if (G.minors) pay.push({ label: u.payMinor, note: `${G.minors}${u.unitP}`, yen: NUM.MINOR * G.minors })
  if (G.silent) ded.push({ label: u.dedSilent, note: `${G.silent}${u.unitT}`, yen: NUM.SIL_FINE * G.silent })
  if (G.evCost) ded.push({ label: u.dedEv, note: `${G.evFail}${u.unitN === '本' ? '件' : ''}`, yen: G.evCost })
  if (G.warns && !raided) ded.push({ label: u.dedWarn, note: `${G.warns}${u.unitT}`, yen: NUM.WARN * G.warns })
  if (raided) ded.push({ label: u.dedRaid, note: '', yen: NUM.RAID })
  const hours = Math.max(1, Math.ceil(t.ex / 3))
  let comment = u.comments[rk]; if (G.mom && !raided) comment = u.comments.mom
  return { lang, no: 5, job: u.job, date: '2026.11.07', wage: 1200, hours, pay, ded, boss: u.boss, comment: `${u.rankName[rk]}。${comment}`, stamp: u.ranks[rk], stampK: 0, photo: G.snap, footer: u.footer, name: u.name, rk, who, spent: t.spent, evOk: G.evOk, evAll: G.evAll, silent: G.silent }
}
function result() {
  store.set('jh_played', '1')
  hideAll(); G.mode = 'end'; G.ev = null; G.evVis = null; G.clock = null; setCards(null); const d = buildSlip(); G.result = d; G.total = totals(d)
  show('vEnd'); fitSlip(); $('#endLabel').textContent = L().spent(d.who); $('#endSales').textContent = yen(0); $('#bAgain').disabled = true; $('#bSave').disabled = true; $('#bPost').disabled = true
  drawSlip(0)
  const id = (G.resId = (G.resId || 0) + 1); G.count = { from: 0, to: d.spent, at: G.t, dur: 1.6, id }
  Sfx('coins')
  later(1.9, () => { if (G.resId !== id) return; G.stampAt = G.t; Sfx('stamp'); Sfx(d.rk === 'raid' || d.rk === 'zero' || d.rk === 'low' ? 'lose' : d.rk === 'mid' || d.rk === 'catch' ? 'win2' : 'win'); $('#bAgain').disabled = false; $('#bSave').disabled = false; $('#bPost').disabled = false })
}
function drawSlip(k) { const d = G.result; if (!d) return; d.stampK = k; drawPayslip($('#slip'), d, { main: '#5a1020', dark: '#1c0a0e', accent: '#d9b45f', bg: '#120b0d' }) }
function fitSlip() {
  const box = $('#slipBox').getBoundingClientRect(), c = $('#slip'); if (!box.width) return
  const s = Math.min(box.width / 1080, box.height / 1350); c.style.width = Math.floor(1080 * s) + 'px'; c.style.height = Math.floor(1350 * s) + 'px'
}
function takeSnap(t, n) {
  const c = document.createElement('canvas'); c.width = c.height = 640; const x = c.getContext('2d'), s = 640 / 800
  drawScene(x, s, 320 - 768 * s, 640 - 880 * s, { forceFace: 'h', noGlass: true })
  const crew = IMG.crew; if (crew) { const w = 760, h = w * crew.height / crew.width; x.drawImage(crew, -60, 640 - h * .72, w, h) }
  const b = IMG[D.BOTTLE[n].i]; if (b) { const h = 300, w = h * b.width / b.height; x.drawImage(b, 320 - w / 2, 150, w, h) }
  G.snap = c
}

// ---------- 文字とボタン
function say(s, cls = '') { const b = $('#bubble'); b.textContent = s; b.className = cls; b.hidden = false; layout() }
function hideBubble() { $('#bubble').hidden = true }
function setClue(s, cls = '') { const c = $('#clue'); c.textContent = s; c.className = cls; c.hidden = false; layout() }
function hideClue() { $('#clue').hidden = true }
function setCards(list, off) {
  const box = $('#cards')
  if (!box.children.length) mk()
  if (!list) { for (const b of box.children) { b.textContent = ' '; b.disabled = true; b.className = 'card' } return layout() }
  ;[...box.children].forEach((b, i) => { const c = list[i]; b.textContent = c ? tx(c.t) : ' '; b.disabled = !!off || !c; b.className = 'card' })
  function mk() { for (let i = 0; i < 3; i++) { const b = document.createElement('button'); b.className = 'card'; b.textContent = ' '; b.disabled = true; b.addEventListener('click', () => { Snd.init(); if (G.mode !== 'event') Sfx('card'); choose(i) }); box.appendChild(b) } }
  layout()
}
function refreshBottle() {
  const t = G.tb, on = !!(t && t.state === 'turn' && G.mode === 'play' && t.tier < D.BOTTLE.length), b = $('#bBottle')
  b.disabled = !on
  b.classList.toggle('ready', !!(on && bottleReady(t)))
}
function updateHud() {
  const u = L(), t = G.tb
  $('#hSales').textContent = yen(t ? t.spent : 0)
  $('#hTable').textContent = t ? honName(t) : ''
  const m = 20 * 60 + (t ? t.ex : 0) * 20; $('#hClock').textContent = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  $('#hNoms').textContent = u.bottlesHud(G.bottles || 0)
}
function openMenu() {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return
  Sfx('card'); G.menuOpen = true; const u = L(), box = $('#mItems'); box.innerHTML = ''
  const note = document.createElement('small'); note.className = 'mnote'; note.textContent = u.locked; box.appendChild(note)
  if (t.gag === 'young' && !t.checked) { const e = document.createElement('button'); e.className = 'mi idb'; e.id = 'mId'; e.innerHTML = '<span></span>'; e.querySelector('span').textContent = u.idcheck; e.addEventListener('click', () => { closeMenu(); t.state = 'react'; idCheck(t, false) }); box.appendChild(e) }
  D.BOTTLE.forEach((b, i) => {
    const e = document.createElement('button'); e.className = 'mi' + (i < t.tier ? ' sold' : i > t.tier ? ' lock' : ' next')
    e.innerHTML = `<img src="img/${b.i}.webp${V}" alt=""><span></span><b></b>`
    e.querySelector('span').textContent = tx(b.n)
    e.querySelector('b').textContent = i < t.tier ? u.sold : yen(b.yen)
    e.disabled = i !== t.tier
    e.addEventListener('click', () => offerBottle()); box.appendChild(e)
  })
  $('#ura').hidden = false; $('#uraT').textContent = u.ura
  const a = $('#mLove'), c = $('#mTsuke'); a.querySelector('span').textContent = u.love; a.querySelector('b').textContent = yen(u.loveYen); c.querySelector('span').textContent = u.tsuke; c.querySelector('b').textContent = yen(u.tsukeYen)
  $('#mTitle').textContent = u.menu; $('#mBack').textContent = u.back; $('#menu').hidden = false
}
function closeMenu() { G.menuOpen = false; $('#menu').hidden = true }
function buildHow() { const u = L(); $('#howBody').innerHTML = `<h2>${u.howto}</h2>` + u.how.map(s => `<p>${s}</p>`).join('') + `<small>${u.legal}</small><a href="privacy.html">${u.privacy}</a>` }
function applyLang() {
  const u = L(); document.documentElement.lang = lang
  $('#tSeries').textContent = u.series; $('#tTitle').innerHTML = lang === 'ja' ? '一晩だけ<em>ホスト</em>' : 'HOST<em>FOR A NIGHT</em>'
  $('#tSub').textContent = u.sub; $('#bStart').textContent = u.start; $('#bHow').textContent = u.howto; $('#howBtn').textContent = u.close; $('#loadT').textContent = u.load
  $('#bLang').textContent = lang === 'ja' ? 'EN' : 'JA'; $('#tBottle').textContent = u.bottle
  $('#bSayNext').textContent = u.next; $('#bSaySkip').textContent = u.skip; $('#bSave').textContent = u.save; $('#bPost').textContent = u.post; $('#bAgain').textContent = u.again; $('#bTitle').textContent = u.toTitle
  buildHow(); updateHud()
  if (G.mode === 'intro') { $('#sayNm').textContent = u.boss; sayLine() }
  const t = G.tb
  if (t && t.state === 'turn' && G.mode === 'play') present(t.node, t.kind, true)
  if (G.mode === 'end' && G.result) { const k = G.result.stampK; G.result = { ...buildSlip(), stampK: k }; drawSlip(k); $('#endLabel').textContent = u.spent(G.result.who) }
}

// ---------- 描画
const cv = $('#cv'), cx = cv.getContext('2d')
let VW = 0, VH = 0, DPR = 1, VIEW = { s: 1, ox: 0, oy: 0, h: 1 }
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); resizeFx(); layout(); if (!$('#vEnd').hidden) fitSlip() }
function computeView() {
  const playing = !$('#vPlay').hidden, h = playing ? $('#hand').getBoundingClientRect().top : VH
  const s = Math.max(h / SH, VW / SW), ox = (VW - SW * s) / 2, oy = h - SH * s
  VIEW = { s, ox, oy, h }
}
function layout() {
  if (!VW) return
  computeView(); const b = $('#bubble'); if (b.hidden) return
  const { s, oy, h } = VIEW, clueH = $('#clue').hidden ? 0 : $('#clue').offsetHeight
  const y = Math.min(oy + 610 * s, h - clueH - b.offsetHeight - 8 - 60 * s)
  b.style.top = Math.max(70, y) + 'px'
}
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t)
function faceOf(t, force) {
  if (force) { const n = t.g.k + '_' + force; if (HAS.has(n)) return n; return t.g.k }
  const r = t.reactFx
  let want = 'n'
  if (r && (r.hold || G.t - r.at < 1.6)) want = r.kind
  else if (t.mood >= 65) want = 'h'
  else if (t.mood < 18) want = 'c'
  const n = want === 'n' ? t.g.k : t.g.k + '_' + want
  return HAS.has(n) ? n : t.g.k
}
// 客のグラス。液面が機嫌、上の泡が残り時間（注いだ瞬間に盛り上がり、消えたら無言扱い）。線やバーは引かない
const foamLeft = () => { const c = G.clock; if (!c) return 0; return Math.max(0, Math.min(1, (c.t1 - G.t) / (c.t1 - c.t0))) }
function drawGlass(x, X, Y, H, mood, foam) {
  const W = H * 0.42, bowl = H * 0.62, topY = Y - H
  // 泡が残り少ないと、客がグラスを指でとんとん叩く
  const tap = foam > 0 && foam < 0.3 ? Math.sin(G.t * 26) * 3 * (1 - foam / 0.3) : 0
  x.save(); x.translate(tap, 0)
  const bowlPath = () => { x.beginPath(); x.moveTo(X - W / 2, topY); x.lineTo(X + W / 2, topY); x.bezierCurveTo(X + W / 2, topY + bowl * .72, X + W * .18, topY + bowl, X, topY + bowl); x.bezierCurveTo(X - W * .18, topY + bowl, X - W / 2, topY + bowl * .72, X - W / 2, topY); x.closePath() }
  x.save(); bowlPath(); x.clip()
  x.fillStyle = 'rgba(255,240,210,.12)'; x.fillRect(X - W, topY, W * 2, bowl)
  const lvl = topY + bowl * (1 - Math.min(92, mood) / 100)
  const gr = x.createLinearGradient(0, lvl, 0, topY + bowl); gr.addColorStop(0, '#f7dd8a'); gr.addColorStop(1, '#c2922f'); x.fillStyle = gr; x.fillRect(X - W, lvl, W * 2, bowl)
  x.fillStyle = 'rgba(255,255,240,.8)'; for (let i = 0; i < 5 && mood > 4; i++) { const ph = (G.t * (.3 + i * .07) + i * .37) % 1, by = topY + bowl - (topY + bowl - lvl) * ph; x.beginPath(); x.arc(X + Math.sin(i * 3.1 + G.t) * W * .16, by, 2.2, 0, 7); x.fill() }
  x.restore()
  // 泡の層。液面から上へ、残り時間の分だけ。縁を越えて盛り上がる
  if (foam > 0.001) {
    const fh = foam * bowl * 0.62, w0 = W * 0.5, top = lvl - fh
    x.fillStyle = 'rgba(255,249,232,.94)'
    x.save(); bowlPath(); x.clip(); x.fillRect(X - W, Math.max(topY, top), W * 2, lvl - Math.max(topY, top) + 2); x.restore()
    if (top < topY) { x.beginPath(); x.ellipse(X, topY + 1, w0 * 1.02, topY - top, 0, Math.PI, Math.PI * 2); x.fill() }
    for (let i = 0; i < 46; i++) {
      const u = (i * 0.6180339) % 1, v = ((i * 0.3819660 * 7) % 1)
      const y = lvl - v * fh, f = (y - topY) / bowl, half = y < topY ? w0 * (1 - Math.min(0.7, (topY - y) / (fh + 1) * 0.7)) : w0 * (1 - f * f * 0.85)
      const px = X + (u * 2 - 1) * Math.max(4, half - 6), r = (5 + (i % 5) * 1.6) * (0.7 + 0.3 * foam) + Math.sin(G.t * 3 + i) * 0.6
      x.strokeStyle = 'rgba(190,160,100,.35)'; x.lineWidth = 1.2; x.fillStyle = i % 3 ? 'rgba(255,253,245,.9)' : 'rgba(255,240,206,.9)'
      x.beginPath(); x.arc(px, y, r * 0.75, 0, 7); x.fill(); x.stroke()
    }
    // 消えかけの泡がはじける
    if (foam < 0.35) { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const ph = (G.t * 2.2 + i * .33) % 1; x.beginPath(); x.arc(X + (i - 1) * W * .22, lvl - fh - 4 - ph * 16, 2 + ph * 7, 0, 7); x.globalAlpha = 1 - ph; x.stroke(); x.globalAlpha = 1 } }
  }
  x.strokeStyle = 'rgba(255,240,210,.85)'; x.lineWidth = 3; bowlPath(); x.stroke()
  x.beginPath(); x.moveTo(X, topY + bowl); x.lineTo(X, Y - 6); x.moveTo(X - W * .36, Y - 3); x.lineTo(X + W * .36, Y - 3); x.stroke()
  x.restore()
}
function drawItem(x, n, X, Y, H, a = 1) { const im = IMG['i_' + n]; if (!im) return; const r = Math.min(H / im.height, H * 1.3 / im.width), w = im.width * r, h = im.height * r; x.globalAlpha *= a; x.fillStyle = 'rgba(0,0,0,.42)'; x.beginPath(); x.ellipse(X, Y + 2, w * .55, 9, 0, 0, 7); x.fill(); x.drawImage(im, X - w / 2, Y - h, w, h); x.globalAlpha /= a }
function drawPerson(x, im, X, dy, k = 1) { if (!im) return; const w = IW * CS * k, h = IH * CS * k; x.drawImage(im, X - w / 2, CY + 26 - 1136 * CS * k + dy, w, h) }
function drawScene(x, s, ox, oy, o = {}) {
  x.save(); x.translate(ox, oy); x.scale(s, s)
  const bg = IMG.bg; if (bg) x.drawImage(bg, 0, 0, SW, SH)
  const t = G.tb, ev = G.ev
  let personImg = null, a = 0, dx = 0, dy = 0
  if (!$('#vTitle').hidden) { personImg = IMG.s_senpai; a = 1 }
  else if (t && t.state !== 'wait') {
    const tin = ease((G.t - t.enterAt) / .6), tout = t.leaveAt != null ? ease((G.t - t.leaveAt) / .5) : 0
    a = tin * (1 - tout); dy = (1 - tin) * 26 + tout * 18 + Math.sin(G.t * 1.5) * 2.5
    if (t.away) a *= 1 - ease((G.t - t.awayAt) / .4)
    if (t.shake != null && G.t - t.shake < .5) { const k = 1 - (G.t - t.shake) / .5; dx = Math.sin(G.t * 70) * 10 * k }
    personImg = IMG[faceOf(t, o.forceFace)] || IMG[t.g.k]
  }
  if (personImg && a > 0.002) { x.globalAlpha = a; G.leanK = G.leanK == null ? 1 : G.leanK; const lk = !t || !$('#vTitle').hidden ? 1 : 0.93 + 0.13 * t.mood / 100; G.leanK += (lk - G.leanK) * 0.08; const w = IW * CS * G.leanK, h = IH * CS * G.leanK; x.drawImage(personImg, 768 - w / 2 + dx, CY + 26 - 1136 * CS * G.leanK + dy, w, h); x.globalAlpha = 1 }
  // 事件の人物: 横から割り込む（誕生日コールは隣の卓の店員たち）
  const vis = G.evVis
  if (vis && !o.noEvent) {
    const im = IMG[vis.img], kin = ease((G.t - vis.at) / .35), kout = vis.out != null ? ease((G.t - vis.out) / .35) : 0
    if (im && kout < 1) {
      if (vis.img === 'crew') { const w = 760, h = w * im.height / im.width, bob = Math.sin(G.t * 9) * 8; x.drawImage(im, 330 - (1 - kin + kout) * 500, CY + 40 - h * .62 + bob, w, h) }
      else drawPerson(x, im, 1010 + (1 - kin) * 520 + kout * 520, Math.sin(G.t * 2) * 3, 1.04)
    }
    if (kout >= 1) G.evVis = null
  }
  // テーブルを人物の手前に描き直す
  // 卓の天板（元画像の 784 行目から下）を人物の前に。元画像は 1672x941 なので、切り出しの高さは画像の中に収める
  // （v2 までは高さ240行を頼んで画像の外にはみ出し、描かれる幅が縮んで下の帯に人物が透けていた）
  if (bg) { const y0 = Math.min(CY, bg.height - 1); x.drawImage(bg, 0, y0, Math.min(SW, bg.width), bg.height - y0, 0, CY, SW, SH - CY) }
  if (t && t.state !== 'wait' && $('#vTitle').hidden && a + (t.away ? 1 : 0) > .02) {
    x.globalAlpha = Math.max(a, t.away ? 1 : 0)
    const ia = t.itemsAt != null ? ease((G.t - t.itemsAt) / .5) : 1
    t.items.forEach((n, i) => drawItem(x, n, SPOT[i].x, SPOT[i].y, SPOT[i].h, ia))
    const third = t.extra || t.walletItem; if (third) drawItem(x, third, SPOT[2].x, SPOT[2].y, SPOT[2].h)
    // こぼした酒（拭くほど小さく）・落ちる財布
    if (ev && ev.k === 'spill' && !(ev.state === 'done' && ev.ok)) { const k = 1 - ev.taps / ev.E.need; x.fillStyle = 'rgba(232,196,110,.72)'; x.beginPath(); x.ellipse(760, 960, 40 + 200 * k, 10 + 34 * k, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,248,220,.5)'; x.beginPath(); x.ellipse(720, 952, 20 + 60 * k, 4 + 8 * k, 0, 0, 7); x.fill() }
    if (ev && ev.k === 'wallet' && ev.state === 'on' && IMG.i_purse) { const p = Math.min(1, (G.t - ev.at) / (ev.t1 - ev.at)); drawItem(x, 'purse', 790 + p * 30, 880 + p * p * 190, 90) }
    if (!o.noGlass) drawGlass(x, GLASS.x, GLASS.y, GLASS.h, t.mood, foamLeft())
    x.globalAlpha = 1
  }
  x.restore()
}
function render() {
  computeView(); const { s, ox, oy } = VIEW
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.fillStyle = '#0b0708'; cx.fillRect(0, 0, VW, VH)
  if ($('#vEnd').hidden) drawScene(cx, s, ox, oy)
  if (G.mode !== 'call' && G.flash > 0.01) { cx.fillStyle = `rgba(255,255,255,${G.flash * .8})`; cx.fillRect(0, 0, VW, VH) }
  drawFx()
}

// ---------- ループ（固定60Hz）
let acc = 0, last = performance.now(), paused = false
function step(dt) {
  G.t += dt
  const due = G.tasks.filter(t => t.at <= G.t); G.tasks = G.tasks.filter(t => t.at > G.t); for (const t of due) if (t.night === G.gen) t.fn()
  const t = G.tb
  // 考える時間。メニューと遊び方を開いている間は泡も止まる
  if (G.mode === 'play' && t && t.state === 'turn') {
    if (G.menuOpen || !$('#how').hidden) { t.deadline += dt; if (G.clock) G.clock.t1 += dt }
    else if (G.t >= t.deadline) silence()
  }
  const ev = G.ev
  if (G.mode === 'event' && ev && ev.state === 'on') {
    if (!ev.shown && G.t >= ev.at + ev.delay) { ev.shown = true; setEvCards() }
    if (G.t >= ev.t1) evResolve(false, null)
  }
  if (G.mode === 'call') { for (const c of confetti) { c.x += c.vx; c.y += c.vy; c.r += c.vr } confetti = confetti.filter(c => c.y < fxc.height + 20); if (G.t >= G.callEndAt) callEnd() }
  G.flash *= .9
  if (G.count) { const k = Math.min(1, (G.t - G.count.at) / G.count.dur); $('#endSales').textContent = yen(G.count.to * ease(k)); if (k >= 1) G.count = null }
  if (G.stampAt != null) { const k = Math.min(1, (G.t - G.stampAt) / .2); drawSlip(k); if (k >= 1) G.stampAt = null }
}
function frame() {
  const n = performance.now(); let dt = Math.min(.25, (n - last) / 1000); last = n
  if (!paused) { acc += dt; while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60 } }
  render(); requestAnimationFrame(frame)
}

// ---------- 入力
// 卓の物を押すと説明が出る。どこを押したかを返す（検証用）
function tapTable(X, Y) {
  const t = G.tb; if (!t || (G.mode !== 'play' && G.mode !== 'event')) return null
  if (Y < 790 || Y > 970) return null
  const all = [...t.items.map(k => ({ k, s: T.ITEMS[k] })), ...[t.extra || t.walletItem].filter(Boolean).map(k => ({ k, s: T.EXTRA[k] }))]
  for (let i = 0; i < all.length; i++) if (Math.abs(X - SPOT[i].x) < 70) { setClue(tx(all[i].s)); return all[i].k }
  return null
}
function bind() {
  const on = (id, fn) => $(id).addEventListener('click', e => { Snd.init(); fn(e) })
  on('#bStart', () => { Sfx('tap'); startNight() })
  on('#bHow', () => { $('#how').hidden = false }); on('#howBtn', () => { $('#how').hidden = true })
  on('#bLang', () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('jh_lang', lang); applyLang() })
  on('#bMute', () => { Snd.setMute(!Snd.muted); muteIcon() })
  on('#bSayNext', introNext); on('#bSaySkip', introEnd)
  on('#bBottle', openMenu); on('#mBack', () => closeMenu())
  on('#mLove', () => ura('love')); on('#mTsuke', () => ura('tsuke'))
  on('#bStopOk', stopOk); on('#bRaid', () => result())
  on('#call', () => { if (G.t - G.callAt > 1.2) callEnd() })
  on('#bAgain', () => { Sfx('tap'); startNight() })
  on('#bTitle', () => { G.gen++; G.mode = 'title'; G.tb = null; G.result = null; show('vTitle') })
  on('#bSave', () => { window.TM && TM.share('save'); $('#slip').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'job-host.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000) }) })
  on('#bPost', () => {
    window.TM && TM.share('x'); const u = L(), r = G.result
    const text = u.shareText(r.who, r.spent, G.bottles, u.rankName[r.rk], r.evOk, r.evAll, r.silent)
    open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.github.io/job-host/'), '_blank')
  })
  cv.addEventListener('pointerdown', e => { const { s, ox, oy } = VIEW; tapTable((e.clientX - ox) / s, (e.clientY - oy) / s) })
  window.addEventListener('resize', resize)
  document.addEventListener('click', e => { if (e.target && e.target.id === 'tmSupport') window.TM && TM.support() })
}
function muteIcon() { $('#icoSnd').style.opacity = Snd.muted ? .35 : 1; $('#bMute').setAttribute('aria-pressed', Snd.muted ? 'true' : 'false') }

// ---------- 検証の窓口
window.HC = {
  G, D, T, NUM, Snd, buildPlay, choose, offerBottle, ura, openMenu, closeMenu, callEnd, stopOk, result, rankOf, affordable, IMG, drawScene, tapTable, SPOT, evCorrect,
  start: (seed, o) => startNight(seed, o),
  // 検証用: 今の一歩に事件を割り込ませる
  forceEvent: (k, cueK) => { const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return false; const E = D.EVENTS[k]; t.state = 'react'; setCards(t.choices, true); startEvent({ k, at: t.ex, cue: E.cues ? (E.cues.find(c => c.k === cueK) || E.cues[0]) : null, delay: 0.6, done: true }); return true },
  checkId: () => { const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn' || t.gag !== 'young' || t.checked) return false; t.state = 'react'; return idCheck(t, false) },
  // 画面に出ている物だけを返す（読むbotはここしか見ない）。_want と grades は検証と「わざと外す」bot だけが使う
  state: () => {
    const t = G.tb, c = t && t.choices, ev = G.ev
    return { mode: G.mode, phase: t ? t.state : null, kind: t ? t.kind : null, ex: t ? t.ex : 0, mood: t ? t.mood : null, k: t ? t.g.k : null, gag: t ? t.gag : null, ready: !!(t && bottleReady(t)), tier: t ? t.tier : 0,
      items: t ? [...t.items] : [], itemsW: t ? t.items.map(k => T.ITEMS[k].w) : [], gestW: t && t.curGest ? t.curGest.w : null, wallet: t ? t.walletItem : null, said: !!(t && t.said), checked: !!(t && t.checked), young: !!(t && t.gag === 'young'),
      line: t && t.node ? t.node.s.ja : null, styles: c ? c.map(o => o.st) : [], texts: c ? c.map(o => o.t.ja) : [], cards: [...document.querySelectorAll('#cards .card')].map(b => b.textContent), _want: t ? t.want : null, grades: c && t ? c.map(o => o.st === t.want ? 'H' : 'M') : [],
      ev: ev ? { k: ev.k, kind: ev.E.kind, state: ev.state, shown: ev.shown, cue: ev.cue ? ev.cue.k : null, opts: ev.order.map(i => ev.E.opts[i].k), taps: ev.taps, need: ev.E.need || 0 } : null,
      left: G.clock ? G.clock.t1 - G.t : null, limit: G.clock ? G.clock.t1 - G.clock.t0 : null, foam: foamLeft(),
      sales: t ? t.spent : 0, bottles: G.bottles, ended: G.ended, warns: G.warns, minors: G.minors, strikes: t ? t.strikes : 0, happy: !!(t && t.happy), silent: G.silent || 0, evOk: G.evOk || 0, evAll: G.evAll || 0, hits: t ? t.hits : 0, misses: t ? t.misses : 0,
      bubble: $('#bubble').hidden ? null : $('#bubble').textContent, clue: $('#clue').hidden ? null : $('#clue').textContent, rk: G.result ? G.result.rk : null, net: G.total ? G.total.net : null }
  },
  dbg: { pause: p => { paused = p }, step: n => { for (let i = 0; i < n; i++) step(1 / 60); render() }, render },
  setLang: l => { lang = l; applyLang() },
}

// ---------- 起動: 本物の読み込み数でグラスに注ぐ
resize(); applyLang(); muteIcon(); bind(); setCards(null)
let done = 0
const FILL = () => { const k = done / FIRST.length, h = 82 * k; const f = $('#loadFill'); f.setAttribute('y', 88 - h); f.setAttribute('height', h) }
const hideLoad = () => { const l = $('#loading'); if (l.dataset.gone) return; l.dataset.gone = 1; l.style.opacity = 0; setTimeout(() => { l.hidden = true }, 360) }
setTimeout(hideLoad, 12000)
Promise.all(FIRST.map(n => loadImg(n).then(() => { done++; FILL() }))).then(() => {
  document.fonts && document.fonts.load && Promise.all(['900 30px "Zen Maru Gothic"', '30px "Dela Gothic One"', '40px "Zen Antique"', '700 16px "Zen Old Mincho"'].map(f => document.fonts.load(f, 'あ'))).catch(() => {})
  hideLoad(); requestAnimationFrame(frame); window.__hcReady = true
  Promise.all(LATER.map(loadImg)).then(() => { window.__hcAll = true; $('#callCrew').src = 'img/crew.webp' + V })
})
