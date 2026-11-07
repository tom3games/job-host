// 一晩だけホスト 本体。客の手元を読んで会話の3択、楽しませてからボトル。乱数で当たり外れを決めない（毎晩のくじは席に着く前に全部決まる）
// 描画は Canvas 2D、時間は固定60Hz（performance.now で数える）
import { drawPayslip, totals } from './payslip.js?v=1'
window.__jsUp = true
const D = window.HD
const $ = s => document.querySelector(s)
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
let lang = store.get('jh_lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const L = () => D.UI[lang]
const tx = o => (o ? (o[lang] ?? o.ja) : '')
const yen = n => '¥' + Math.round(n).toLocaleString('en-US')
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---------- 釣り合いの数字（sim.mjs で確かめる）
export const NUM = { START: 25, GOOD: 20, DEEP: 22, SUB: 12, BAD: -8, SWAP: -12, MEH: 2, MEH2: -2, MINE: -22, COMEBACK: 26, BORED: -14, SILENT: -14, EARLY: -25, OVER: -20, SOLD: -18, TURNS: 6, HELP_TURNS: 4, TURN_SEC: 14, NOMI: 60, FINE: 30000, HELP: 10000, MINOR: 5000, WARN: 10000, RAID: 1000000, NOMI_BACK: 30000, TOWER: 500000, TOWER_NEED: 3, COMM: 0.2 }
const RANK = [[1200000, 'legend'], [600000, 'top'], [200000, 'mid'], [30000, 'low'], [0, 'zero']]

// ---------- 画像
const V = '?v=1'
const IMG = {}
const ITEMS = ['mirror', 'lipstick', 'brooch', 'medicine', 'phone', 'papers', 'fish', 'nose', 'ticket', 'book', 'earbuds', 'readers', 'senpai', 'pass', 'ledger', 'cards', 'coupons', 'purse']
// 最初の画面に要る物だけ待つ。コールの絵などは準備完了のあと裏で読む
const FIRST = ['bg', 's_senpai', 'b1']
const LATER = ['s_boss', 'crew', 's_naikin', 'b2', 'b3', 'tower', ...ITEMS.map(n => 'i_' + n)]
const loadImg = n => new Promise(res => { if (IMG[n]) return res(); const im = new Image(); im.onload = () => { IMG[n] = im; res() }; im.onerror = () => { console.error('img ' + n); res() }; im.src = 'img/' + n + '.webp' + V })
const faces = g => [g.k, g.k + '_h', g.k + '_c'].filter(n => HAS.has(n))
const HAS = new Set(['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].flatMap(k => [k, k + '_h', k + '_c']).concat(['x_tax', 'x_tax_c', 'x_oba', 'x_oba_h', 'x_oba_c', 'x_mom', 'x_mom_h', 'x_oji', 'x_oji_h', 'x_young', 'x_young_h']))

// ---------- 場面の座標（背景 1536x1024、人物は 640x960 に縮めてあるが 896x1344 のつもりで置く）
const SW = 1536, SH = 1024, CY = 784, CS = 0.62, IW = 896, IH = 1344, CTOP = CY - 1110 * CS, CX0 = 768 - IW * CS / 2

// ---------- 状態
const G = { mode: 'title', t: 0, tasks: [], night: [], idx: -1, tb: null, sales: 0, noms: 0, bottles: 0, helps: 0, minors: 0, fines: 0, warns: 0, ended: null, seed: 1, snap: null, log: [], hold: false, flash: 0, bestPrice: 0, mom: false, tut: 0, callAt: 0 }
const later = (d, fn) => G.tasks.push({ at: G.t + d, fn, night: G.gen })
const sayMin = s => Math.max(1.5, 0.9 + 0.09 * s.length)

// ---------- 1晩のくじ。同じ種なら同じ夜
function buildNight(seed) {
  const r = rng(seed), shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a }, pick = a => a[(r() * a.length) | 0]
  const regs = shuffle(D.REG), wants = shuffle(D.TAGS), wallets = shuffle(['rich', 'mid', 'mid', pick(['poor', 'poor2'])])
  const nightNeta = shuffle(D.NETA).slice(0, 4), out = []
  for (let i = 0; i < 4; i++) out.push({ g: regs[i], main: wants[i], wallet: wallets[i] })
  // 先輩の客（永久指名）は2卓目以降に6割の夜だけ
  if (r() < 0.6) { const j = 1 + ((r() * 3) | 0); out[j].senpai = true }
  // 変な客。店長の母はたまにしか来ない
  const gagKey = r() < 0.12 ? 'mom' : pick(['tax', 'oba', 'oji', 'young'])
  const gag = D.GAG[gagKey], gt = { g: gag, gag: gagKey, main: gag.main || pick(D.TAGS), wallet: gag.wallet || 'mid' }
  if (gag.young) { gt.minor = r() < 0.5; gt.wallet = gt.minor ? 'mid' : pick(['mid', 'rich']) }
  out.splice(2 + ((r() * 3) | 0), 0, gt)
  out.forEach((t, i) => {
    t.i = i
    t.sub = t.g.sub || pick(D.TAGS.filter(x => x !== t.main))
    t.item = t.g.item || pick(D.CLUE[t.main]); t.clue0 = t.item
    t.gesture = pick(D.GESTURE[t.sub])
    const w = D.WALLET[t.wallet]; t.walletYen = w.yen; t.walletItem = w.i ? w : null
    // 最初の一言は4割の客で建前（しぐさと食い違う）。しぐさが本当
    t.helloTag = r() < 0.4 ? pick(D.TAGS.filter(x => x !== t.main)) : t.main
    t.hello = t.g.hello || pick(D.HELLO[t.helloTag])
    if (t.g.hoh) t.helloTag = null
    // 毎手、4種類のうち1つが出ない。順番は卓ごとのくじ。1手目は本命を必ず出す
    const c = shuffle(D.TAGS); if (c[0] === t.main) { c[0] = c[1]; c[1] = t.main } t.omit = c
    // 本物の言葉。褒めるのは卓の持ち物の細部から。持ちネタは同じ夜の同じ客で一周すると同じ話になる
    const neta = [nightNeta[i % 4], nightNeta[(i + 1) % 4]]
    t.pool = { praise: [...(D.DETAIL[t.item.i] || []), ...shuffle(D.LINES.praise)], listen: shuffle(D.LINES.listen), quiet: shuffle(D.LINES.quiet), joke: neta }
    t.hollow = {}; for (const k of D.TAGS) t.hollow[k] = shuffle(D.HOLLOW[k])
    t.deepL = shuffle(D.DEEP); t.mines = shuffle(D.MINE); t.backs = shuffle(D.COMEBACK); t.used = new Set(); t.comeback = false; t.prev = null; t.early = 0
    t.order = Array.from({ length: 8 }, () => shuffle([0, 1, 2]))
    t.mood = NUM.START; t.turn = 0; t.tags = []; t.bored = 0; t.sil = 0; t.sold = 0; t.state = 'wait'; t.checked = false; t.spent = 0
  })
  return out
}

// ---------- 画面
function show(v) { for (const id of ['vTitle', 'vPlay', 'vEnd']) $('#' + id).hidden = id !== v; layout() }
function startNight(seed, opts = {}) {
  ambOn(); hideAll()
  G.gen = (G.gen || 0) + 1
  G.seed = seed ?? ((Math.random() * 1e9) | 0)
  G.night = buildNight(G.seed); Object.assign(G, { idx: -1, tb: null, sales: 0, noms: 0, bottles: 0, helps: 0, minors: 0, fines: 0, warns: 0, ended: null, snap: null, log: [], tasks: [], hold: false, bestPrice: 0, mom: false, tut: 0, bossVis: null, callState: null, tower: false, menuOpen: false, count: null, stampAt: null, result: null, total: null, raidKind: null })
  for (const t of G.night) for (const n of faces(t.g)) loadImg(n)
  if (!$('#callCrew').getAttribute('src')) $('#callCrew').src = 'img/crew.webp' + V
  window.TM && TM.start()
  updateHud(); show('vPlay'); setCards(null)
  if (opts.skipIntro) { nextTable(); return }
  G.mode = 'intro'; G.tut = store.get('jh_tut') === '1' ? 0 : 1
  G.introI = 0; $('#sayImg').src = 'img/s_boss.webp' + V; $('#sayNm').textContent = L().boss; sayLine(); $('#say').hidden = false
}
function sayLine() { $('#sayLine').textContent = L().intro[G.introI] }
function introNext() { Sfx('card'); G.introI++; if (G.introI >= L().intro.length) introEnd(); else sayLine() }
function introEnd() { $('#say').hidden = true; nextTable() }
function hideAll() { for (const id of ['#menu', '#call', '#stop', '#raid', '#say', '#how']) $(id).hidden = true; hideBubble(); hideClue() }

function nextTable() {
  G.mode = 'play'; G.idx++; G.tb = null; setCards(null); hideBubble(); hideClue()
  updateHud()
  if (G.idx >= G.night.length) return closing()
  // 卓の合間に先輩の妙な一言（2回に1回・文字は1つだけ）
  if (G.idx > 0 && G.idx % 2 === 0) {
    G.bossVis = { img: 's_senpai', at: G.t }; say(tx(D.QUIP[(G.seed + G.idx) % D.QUIP.length]), 'boss')
    later(1.9, () => { G.bossVis = null; hideBubble(); seat() }); return
  }
  seat()
}
function seat() {
  const t = G.night[G.idx]; G.tb = t; t.state = 'enter'; t.enterAt = G.t; t.leaveAt = null; t.reactFx = null
  updateHud(); Sfx('card')
  later(0.8, () => {
    if (G.tb !== t) return
    say(tx(t.hello)); setClue(tx(t.senpai ? D.SENPAI_CARD : t.clue0))
    later(sayMin(tx(t.hello)) * 0.6, () => { if (G.tb === t) beginTurn() })
  })
}
function offered(t) {
  // 毎手4種類のうち1つが出ない。残り3枚のうち1枚は薄い言葉か地雷。直前に当たれば深掘り、滑れば挽回の札に替わる
  const miss = t.omit[t.turn % 4], tags = D.TAGS.filter(x => x !== miss), ord = t.order[t.turn % 8].map(i => tags[i])
  // 1手目と、2つ目の話が出ない手は、本命を薄い札にしない（読めても打つ手が無い手を作らない）
  let slot = t.turn % 3; if (ord[slot] === t.main && (t.turn === 0 || miss === t.sub)) slot = (slot + 1) % 3
  const list = ord.map((tag, i) => i === slot ? { tag, form: 'hollow', text: cycle(t.hollow[tag]) } : { tag, form: 'real', text: cycle(t.pool[tag]) })
  if (t.turn % 2 === 1) list[slot] = { tag: 'mine', form: 'mine', text: cycle(t.mines) }
  if (t.prev === 'good' || t.prev === 'sub') list[slot] = { tag: 'deep', form: 'deep', text: cycle(t.deepL) }
  else if ((t.prev === 'bad' || t.prev === 'mine' || t.prev === 'swap') && !t.comeback) list[slot] = { tag: 'back', form: 'back', text: cycle(t.backs) }
  if (t.g.young && !t.checked) list[slot] = { tag: 'id', form: 'id', text: { ja: L().idcheck, en: L().idcheck } }
  return list
}
const cycle = p => { const o = p.shift(); p.push(o); return o }
const attKey = m => m < 25 ? 'low' : m < 45 ? 'mid' : m < 65 ? 'warm' : m < 85 ? 'lean' : 'full'
function attLine(t) { const a = D.ATT[attKey(t.mood)]; return a ? a[(t.turn + t.i) % a.length] : null }
function pickClue(t) {
  // 1手目は持ち物、2手目は2つ目のしぐさ、3手目は財布、以降は今の態度。冷めている時はいつも態度
  if (t.senpai && t.turn === 0) return D.SENPAI_CARD
  if (attKey(t.mood) === 'low' && t.turn > 0) return attLine(t)
  if (t.turn === 0) return t.clue0
  if (t.turn === 1) return t.senpai ? t.clue0 : t.gesture
  if (t.turn === 2) return t.senpai ? t.gesture : (t.walletItem || attLine(t) || t.gesture)
  return attLine(t) || t.gesture
}
function beginTurn() {
  const t = G.tb; if (!t) return
  t.state = 'turn'; t.choices = offered(t); t.deadline = G.t + NUM.TURN_SEC
  setCards(t.choices); refreshBottle()
  setClue(tx(pickClue(t)))
  if (G.tut === 1) { G.tut = 2; tip(L().tut.clue) }
  else if (G.tut === 2 && t.mood >= D.BOTTLE[0].need && !t.senpai) { G.tut = 0; tip(L().tut.bottle) }
}
function endTurn() {
  const t = G.tb; if (!t) return
  t.turn++
  if (t.state === 'gone') return
  if (t.mood <= 0 || t.bored >= 2 || t.sil >= 2 || t.turn >= (t.senpai ? NUM.HELP_TURNS : NUM.TURNS)) return leaveTable()
  beginTurn()
}

// ---------- 会話を選ぶ
function choose(i) {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return false
  const c = t.choices[i]; if (!c) return false
  t.state = 'react'; setCards(t.choices, true); refreshBottle()
  if (c.tag === 'id') return idCheck(t)
  const tKey = c.text.ja, lastTwo = t.tags.slice(-2)
  let kind
  if (c.form === 'mine') kind = 'mine'
  else if (c.form === 'back') { kind = 'comeback'; t.comeback = true }
  else if (c.form === 'deep') kind = 'deep'
  else if (t.used.has(tKey) || (lastTwo.length === 2 && lastTwo[0] === c.tag && lastTwo[1] === c.tag)) kind = 'bored'
  else if (c.form === 'hollow') kind = c.tag === t.main ? 'meh' : 'meh2'
  else if (c.tag === t.main) kind = 'good'
  else if (c.tag === t.sub) kind = 'sub'
  else kind = (t.prev === 'good' || t.prev === 'deep') ? 'swap' : 'bad'
  t.used.add(tKey); t.tags.push(c.tag); t.sil = 0
  const d = { good: NUM.GOOD, deep: NUM.DEEP, sub: NUM.SUB, bad: NUM.BAD, swap: NUM.SWAP, meh: NUM.MEH, meh2: NUM.MEH2, mine: NUM.MINE, comeback: NUM.COMEBACK, bored: NUM.BORED }[kind]
  setMood(t, d); if (kind === 'bored') t.bored++
  t.prev = kind
  G.log.push(`${t.g.k}:${c.tag}:${c.form}:${kind}`)
  react(t, kind, c.tag)
  return true
}
function react(t, kind, tag) {
  const pick = a => a[(t.turn + t.i) % a.length]
  let s
  const pos = kind === 'good' || kind === 'sub' || kind === 'deep' || kind === 'comeback'
  if (t.g.hoh) s = pos ? t.g.good : t.g.bad
  else if (pos && t.g.good && kind !== 'comeback') s = t.g.good
  else if (kind === 'bad' && t.g.bad) s = t.g.bad
  else if (kind === 'good') s = pick(D.REACT.good[t.main])
  else if (kind === 'meh2') s = pick(D.REACT.meh)
  else if (kind === 'bad') s = pick(D.REACT.bad[tag] || D.REACT.bad.praise)
  else s = pick(D.REACT[kind])
  t.reactFx = { kind: pos ? 'h' : kind === 'meh' || kind === 'meh2' ? 'n' : 'c', at: G.t }
  if (pos) Sfx('good'); else if (kind !== 'meh' && kind !== 'meh2') { t.shake = G.t; Sfx('bad') }
  say(tx(s))
  later(sayMin(tx(s)), () => { if (G.tb === t && t.state === 'react') endTurn() })
}
function setMood(t, d) { t.mood = Math.max(0, Math.min(100, t.mood + d)); refreshBottle() }
function silence() {
  const t = G.tb; t.state = 'react'; setCards(t.choices, true); t.sil++; t.prev = 'bad'; setMood(t, NUM.SILENT); G.log.push(t.g.k + ':silent')
  react(t, 'silence')
}
function idCheck(t) {
  t.checked = true; G.log.push(t.g.k + ':id')
  if (t.minor) {
    G.minors++; const s = tx(t.g.idNG); say(s); t.reactFx = { kind: 'c', at: G.t }; setClue(L().minorSent)
    t.mood = 0; later(Math.max(2, sayMin(s)), () => { if (G.tb === t) goneTable() })
  } else {
    setMood(t, 20); t.reactFx = { kind: 'h', at: G.t }; const s = tx(t.g.idOK); say(s); Sfx('good')
    later(sayMin(s), () => { if (G.tb === t && t.state === 'react') endTurn() })
  }
  return true
}

// ---------- ボトル
function offerBottle(n) {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return false
  closeMenu(); t.state = 'react'; setCards(t.choices, true); refreshBottle()
  const b = D.BOTTLE[n]; G.log.push(`${t.g.k}:bottle${n}`)
  if (t.senpai) return senpaiMad(t)
  if (t.g.young && t.minor && !t.checked) return raid('minor')
  // 楽しさを渡す前の「買って」は押し売り。必ず失敗する。2回で帰る
  if (t.mood < b.need) { setMood(t, NUM.EARLY); t.early++; t.prev = 'bad'; if (t.early >= 2) t.mood = 0; react(t, 'early'); return true }
  if (b.yen > t.walletYen - t.spent) { setMood(t, NUM.OVER); t.prev = 'bad'; react(t, 'over'); return true }
  // 売れた
  t.prev = null; t.spent += b.yen; t.sold++; G.sales += b.yen; G.bottles++; setMood(t, NUM.SOLD); updateHud()
  if (t.g.mom) G.mom = true
  t.reactFx = { kind: 'h', at: G.t }
  const s = t.g.buy || D.REACT.buy[(t.turn + t.i) % 2]; say(tx(s))
  later(0.8, () => { if (G.tb === t) champagneCall(n, t) })
  return true
}
function ura(kind) {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn' || t.g.young) return false
  closeMenu(); t.state = 'react'; setCards(t.choices, true); refreshBottle(); G.log.push(`${t.g.k}:${kind}`)
  G.warns++
  if (G.warns >= 2) { raid(kind); return true }
  if (t.g.k === 'x_tax') { raid('tax'); return true }
  stopScene(kind === 'love' ? L().stopLove : L().stopTsuke, 's_naikin', `${L().stopFine} -${yen(NUM.WARN)}`, 'run', () => goneTable())
  return true
}
function senpaiMad(t) {
  G.fines++
  stopScene(L().senpaiMad, 's_senpai', `${L().senpaiFine} -${yen(NUM.FINE)}`, 'bad', () => goneTable())
  return true
}
function stopScene(line, img, fine, sfx, after) {
  G.mode = 'stop'; hideBubble(); Sfx(sfx)
  $('#stopImg').src = 'img/' + img + '.webp' + V; const im = $('#stopImg'); im.classList.add('far'); requestAnimationFrame(() => im.classList.remove('far'))
  $('#stopLine').textContent = line; $('#stopFine').textContent = fine; $('#bStopOk').textContent = L().stopOk; $('#stop').hidden = false
  G.stopAfter = after
}
function stopOk() { if (G.mode !== 'stop') return; $('#stop').hidden = true; G.mode = 'play'; const f = G.stopAfter; G.stopAfter = null; f && f() }
function raid(kind) {
  const u = L(); G.ended = 'raid'; G.mode = 'raid'; G.raidKind = kind; hideBubble(); hideClue(); setCards(null); closeMenu()
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
function champagneCall(n, t) {
  const b = D.BOTTLE[n], who = tx(t.g.name) + (t.g.title ? tx(t.g.title) : (lang === 'ja' ? '姫' : ''))
  const pool = D.CALL.mid.slice(1), pick = pool[(G.seed + G.bottles * 3) % pool.length], pick2 = pool[(G.seed + G.bottles * 3 + 4) % pool.length]
  const lines = [D.CALL.open[0], { ja: D.CALL.mid[0].ja.replace('{n}', who), en: D.CALL.mid[0].en.replace('{n}', who) }, pick]
  if (n >= 1) lines.push(pick2)
  if (n >= 2) lines.push(pool[(G.seed + G.bottles * 3 + 7) % pool.length])
  lines.push(D.CALL.last[0])
  runCall({ img: 'b' + (n + 1), sub: `+${yen(b.yen)}`, lines, big: n }, () => { if (G.tb === t) { t.state = 'react'; endTurn() } })
  takeSnap(t, n)
}
function runCall(o, after) {
  G.mode = 'call'; hideBubble(); hideClue(); setCards(null, true); G.callAfter = after; G.callAt = G.t; G.callDone = false
  const u = $('#call'); u.hidden = false; resizeFx(); confetti = []; burst(120 + o.big * 60)
  $('#callItem').src = 'img/' + o.img + '.webp' + V; const it = $('#callItem'), crew = $('#callCrew'), big = $('#callBig')
  it.classList.remove('in'); crew.classList.remove('in', 'bob'); big.textContent = ''; $('#callSub').textContent = o.sub
  requestAnimationFrame(() => it.classList.add('in'))
  Sfx('sold'); Hype(true); G.flash = 1
  const g = G.gen, callId = (G.callId = (G.callId || 0) + 1)
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
  // 店の光。ゆっくり振れるスポットライト
  for (let i = 0; i < 5; i++) {
    const sw = Math.sin(a * (0.9 + i * .23) + i * 1.7), x = W * (0.1 + i * .2), tx0 = x + sw * W * 0.34
    const gr = fx.createLinearGradient(x, -10, tx0, H); gr.addColorStop(0, `rgba(255,220,140,${.34 - i * .02})`); gr.addColorStop(1, 'rgba(255,200,120,0)')
    fx.fillStyle = gr; fx.beginPath(); fx.moveTo(x - 8, -10); fx.lineTo(x + 8, -10); fx.lineTo(tx0 + W * .16, H); fx.lineTo(tx0 - W * .16, H); fx.closePath(); fx.fill()
  }
  if (G.flash > 0.01) { fx.fillStyle = `rgba(255,240,200,${G.flash * .75})`; fx.fillRect(0, 0, W, H) }
  for (const c of confetti) { fx.save(); fx.translate(c.x, c.y); fx.rotate(c.r); fx.fillStyle = c.c; fx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); fx.restore() }
}

// ---------- 帰る
function leaveTable() {
  const t = G.tb, u = D.REACT
  if (t.state === 'gone') return
  t.state = 'gone'; setCards(null, true); refreshBottle()
  let s
  if (t.senpai) {
    if (t.mood >= 50) { G.helps++; s = { ja: L().senpaiHelp, en: L().senpaiHelp }; t.leaveImg = 's_senpai' } else s = u.leaveOk[t.i % 2]
    say(tx(s)); if (t.mood >= 50) { setClue(`${L().payHelp} +${yen(NUM.HELP)}`); Sfx('coins') }
  } else {
    const happy = t.mood >= NUM.NOMI && !t.bored
    if (happy) { G.noms++; t.nomi = true; Sfx('card') }
    s = t.g.leave || (happy ? u.leaveGood : t.mood < 25 ? u.leaveBad : u.leaveOk)[t.i % 2]
    if (s && s.ja === undefined) s = s[0]
    say(tx(s)); t.reactFx = { kind: happy ? 'h' : t.mood < 25 ? 'c' : 'n', at: G.t, hold: true }
    if (happy) updateHud()
  }
  t.leaveAt = G.t + sayMin(tx(s)) - 0.5
  later(sayMin(tx(s)), () => { if (G.tb === t) nextTable() })
}
function goneTable() {
  const t = G.tb; if (!t) return nextTable()
  t.state = 'gone'; t.leaveAt = G.t; setCards(null, true); hideBubble(); later(0.8, () => { if (G.tb === t) nextTable() })
}

// ---------- 閉店: 指名客が戻ってくる
function closing() {
  G.mode = 'closing'; setCards(null); hideClue()
  if (!G.noms) return later(0.1, () => goResult())
  const add = G.noms * NUM.NOMI_BACK
  G.sales += add; G.bottles += G.noms; updateHud()
  G.bossVis = { img: 's_boss', at: G.t }; say(L().nomiBack(G.noms), 'boss'); Sfx('coins')
  later(2.2, () => {
    hideBubble(); G.bossVis = null
    if (G.noms >= NUM.TOWER_NEED) {
      G.sales += NUM.TOWER; G.tower = true; updateHud()
      const lines = D.CALL.tower
      runCall({ img: 'tower', sub: `+${yen(NUM.TOWER)}`, lines, big: 3 }, () => goResult())
      takeSnap(null, 3)
    } else goResult()
  })
}
function rankOf(sales) { for (const [v, k] of RANK) if (sales >= v) return k; return 'zero' }
function goResult() {
  G.ended = G.ended || 'close'; window.TM && TM.end(G.sales, true); result()
}

// ---------- 結果
function buildSlip() {
  const u = L(), raided = G.ended === 'raid', rk = raided ? 'raid' : rankOf(G.sales)
  const pay = [], ded = []
  pay.push({ label: u.payComm, note: u.note(G.sales), yen: raided ? 0 : Math.round(G.sales * NUM.COMM) })
  if (G.noms) pay.push({ label: u.payNomi, note: `${G.noms}${u.unitN}`, yen: raided ? 0 : G.noms * 3000 })
  if (G.bottles) pay.push({ label: u.payBottle, note: `${G.bottles}${u.unitN}`, yen: raided ? 0 : G.bottles * 1000 })
  if (G.helps) pay.push({ label: u.payHelp, note: `${G.helps}${u.unitT}`, yen: NUM.HELP * G.helps })
  if (G.minors) pay.push({ label: u.payMinor, note: `${G.minors}${u.unitP}`, yen: NUM.MINOR * G.minors })
  if (G.fines) ded.push({ label: u.dedFine, note: `${G.fines}${u.unitT}`, yen: NUM.FINE * G.fines })
  if (G.warns && !raided) ded.push({ label: u.dedWarn, note: `${G.warns}${u.unitT}`, yen: NUM.WARN * G.warns })
  if (raided) ded.push({ label: u.dedRaid, note: '', yen: NUM.RAID })
  const hours = raided ? Math.max(0.5, (G.idx + 1)) : 5
  let comment = u.comments[rk]; if (G.mom && !raided) comment = u.comments.mom
  return { lang, no: 5, job: u.job, date: '2026.11.07', wage: 1200, hours, pay, ded, boss: u.boss, comment: `${u.rankName[rk]}。${comment}`, stamp: u.ranks[rk], stampK: 0, photo: G.snap, footer: u.footer, name: u.name, rk }
}
function result() {
  hideAll(); G.mode = 'end'; G.tb = null; setCards(null); const d = buildSlip(); G.result = d; G.total = totals(d)
  show('vEnd'); fitSlip(); $('#endLabel').textContent = L().sales; $('#endSales').textContent = yen(0); $('#bAgain').disabled = true; $('#bSave').disabled = true; $('#bPost').disabled = true
  drawSlip(0)
  const c0 = G.t, id = (G.resId = (G.resId || 0) + 1); G.count = { from: 0, to: G.sales, at: c0, dur: 1.6, id }
  Sfx('coins')
  later(1.9, () => { if (G.resId !== id) return; G.stampAt = G.t; Sfx('stamp'); Sfx(d.rk === 'raid' || d.rk === 'zero' ? 'lose' : d.rk === 'low' ? 'lose' : d.rk === 'mid' ? 'win2' : 'win'); $('#bAgain').disabled = false; $('#bSave').disabled = false; $('#bPost').disabled = false })
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
  const b = IMG[t ? 'b' + (n + 1) : 'tower']; if (b) { const h = 300, w = h * b.width / b.height; x.drawImage(b, 320 - w / 2, 150, w, h) }
  G.snap = c
}

// ---------- 文字とボタン
function say(s, cls = '') { const b = $('#bubble'); b.textContent = s; b.className = cls; b.hidden = false; layout() }
function hideBubble() { $('#bubble').hidden = true }
function setClue(s, cls = '') { const c = $('#clue'); c.textContent = s; c.className = cls; c.hidden = false; G.clueAt = G.t }
function hideClue() { $('#clue').hidden = true }
function tip(s) { say(s, 'boss'); store.set('jh_tut', '1') }
function setCards(list, off) {
  const box = $('#cards')
  if (!list) { for (const b of box.children) { b.textContent = ' '; b.disabled = true; b.className = 'card' } if (!box.children.length) mk(); return }
  if (!box.children.length) mk()
  ;[...box.children].forEach((b, i) => { const c = list[i]; b.textContent = c ? tx(c.text) : ' '; b.disabled = !!off || !c; b.className = 'card' + (c && c.tag === 'id' ? ' id' : '') })
  function mk() { for (let i = 0; i < 3; i++) { const b = document.createElement('button'); b.className = 'card'; b.textContent = ' '; b.disabled = true; b.addEventListener('click', () => { Snd.init(); Sfx('card'); choose(i) }); box.appendChild(b) } }
  layout()
}
function refreshBottle() {
  const t = G.tb, on = !!(t && t.state === 'turn'), b = $('#bBottle')
  b.disabled = !on
  b.classList.toggle('ready', !!(t && on && t.mood >= D.BOTTLE[0].need && !t.senpai))
}
function updateHud() {
  const u = L(); $('#hSales').textContent = yen(G.sales)
  $('#hTable').textContent = `${u.table} ${Math.min(G.idx + 1, G.night.length) || 1}/${G.night.length || 5}`
  const m = 19 * 60 + Math.max(0, G.idx) * 60; $('#hClock').textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:00`
  $('#hNoms').textContent = `${u.noms} ${G.noms}`
}
function openMenu() {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return
  Sfx('card'); G.menuOpen = true; const u = L(), box = $('#mItems'); box.innerHTML = ''
  D.BOTTLE.forEach((b, i) => { const e = document.createElement('button'); e.className = 'mi'; e.innerHTML = `<img src="img/${b.i}.webp${V}" alt=""><span></span><b></b>`; e.querySelector('span').textContent = tx(b.n); e.querySelector('b').textContent = yen(b.yen); e.addEventListener('click', () => offerBottle(i)); box.appendChild(e) })
  $('#ura').hidden = !!t.g.young; $('#uraT').textContent = u.ura
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
  if (G.tb && G.tb.state === 'turn') { setCards(G.tb.choices); }
  if (G.mode === 'end' && G.result) { const k = G.result.stampK; G.result = { ...buildSlip(), stampK: k }; drawSlip(k); $('#endLabel').textContent = u.sales }
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
function drawGlass(x, X, Y, H, mood) {
  // 客のグラス。機嫌がそのまま液面になる。勧めどきは態度で読む
  const W = H * 0.42, bowl = H * 0.62, topY = Y - H
  const bowlPath = () => { x.beginPath(); x.moveTo(X - W / 2, topY); x.lineTo(X + W / 2, topY); x.bezierCurveTo(X + W / 2, topY + bowl * .72, X + W * .18, topY + bowl, X, topY + bowl); x.bezierCurveTo(X - W * .18, topY + bowl, X - W / 2, topY + bowl * .72, X - W / 2, topY); x.closePath() }
  x.save(); bowlPath(); x.clip()
  x.fillStyle = 'rgba(255,240,210,.12)'; x.fillRect(X - W, topY, W * 2, bowl)
  const lvl = topY + bowl * (1 - mood / 100)
  const gr = x.createLinearGradient(0, lvl, 0, topY + bowl); gr.addColorStop(0, '#f7dd8a'); gr.addColorStop(1, '#c2922f'); x.fillStyle = gr; x.fillRect(X - W, lvl, W * 2, bowl)
  x.fillStyle = 'rgba(255,255,240,.8)'; for (let i = 0; i < 5 && mood > 4; i++) { const ph = (G.t * (.3 + i * .07) + i * .37) % 1, by = topY + bowl - (topY + bowl - lvl) * ph; x.beginPath(); x.arc(X + Math.sin(i * 3.1 + G.t) * W * .16, by, 2.2, 0, 7); x.fill() }
  x.restore()
  x.strokeStyle = 'rgba(255,240,210,.85)'; x.lineWidth = 3; bowlPath(); x.stroke()
  x.beginPath(); x.moveTo(X, topY + bowl); x.lineTo(X, Y - 6); x.moveTo(X - W * .36, Y - 3); x.lineTo(X + W * .36, Y - 3); x.stroke()
}
function drawItem(x, n, X, Y, H) { const im = IMG['i_' + n]; if (!im) return; const r = Math.min(H / im.height, H * 1.25 / im.width), w = im.width * r, h = im.height * r; x.fillStyle = 'rgba(0,0,0,.42)'; x.beginPath(); x.ellipse(X, Y + 2, w * .55, 9, 0, 0, 7); x.fill(); x.drawImage(im, X - w / 2, Y - h, w, h) }
function drawScene(x, s, ox, oy, o = {}) {
  x.save(); x.translate(ox, oy); x.scale(s, s)
  const bg = IMG.bg; if (bg) x.drawImage(bg, 0, 0, SW, SH)
  const t = G.tb
  let personImg = null, a = 0, dx = 0, dy = 0
  if (!$('#vTitle').hidden) { personImg = IMG.s_senpai; a = 1 }
  else if (G.bossVis) { personImg = IMG[G.bossVis.img]; a = ease((G.t - G.bossVis.at) / .25) }
  else if (t && t.state !== 'wait') {
    const tin = ease((G.t - t.enterAt) / .6), tout = t.leaveAt != null ? ease((G.t - t.leaveAt) / .5) : 0
    a = tin * (1 - tout); dy = (1 - tin) * 26 + tout * 18 + Math.sin(G.t * 1.5) * 2.5
    if (t.shake != null && G.t - t.shake < .5) { const k = 1 - (G.t - t.shake) / .5; dx = Math.sin(G.t * 70) * 10 * k }
    const f = t.leaveImg && t.state === 'gone' ? t.leaveImg : faceOf(t, o.forceFace); personImg = IMG[f] || IMG[t.g.k]
  }
  if (personImg && a > 0.002) { x.globalAlpha = a; G.leanK = G.leanK == null ? 1 : G.leanK; const lk = G.bossVis || !t ? 1 : 0.93 + 0.13 * t.mood / 100; G.leanK += (lk - G.leanK) * 0.08; const w = IW * CS * G.leanK, h = IH * CS * G.leanK; x.drawImage(personImg, 768 - w / 2 + dx, CY + 26 - 1136 * CS * G.leanK + dy, w, h); x.globalAlpha = 1 }
  // テーブルを人物の手前に描き直す
  if (bg) x.drawImage(bg, 0, CY, SW, SH - CY, 0, CY, SW, SH - CY)
  if (t && t.state !== 'wait' && !G.bossVis && a > .02) {
    x.globalAlpha = a
    if (t.item) drawItem(x, t.item.i, 575, 900, 112)
    if (t.senpai) drawItem(x, 'senpai', 770, 930, 72)
    else if (t.walletItem) drawItem(x, t.walletItem.i, 770, 930, 90)
    if (!o.noGlass) drawGlass(x, 985, 925, 210, t.mood)
    x.globalAlpha = 1
  }
  x.restore()
}
function render() {
  computeView(); const { s, ox, oy } = VIEW
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.fillStyle = '#0b0708'; cx.fillRect(0, 0, VW, VH)
  if ($('#vEnd').hidden) drawScene(cx, s, ox, oy)
  drawFx()
}

// ---------- ループ（固定60Hz）
let acc = 0, last = performance.now(), paused = false
function step(dt) {
  G.t += dt
  const due = G.tasks.filter(t => t.at <= G.t); G.tasks = G.tasks.filter(t => t.at > G.t); for (const t of due) if (t.night === G.gen) t.fn()
  const t = G.tb
  // 考える時間。メニューを開いている間と説明中は止まる
  if (G.mode === 'play' && t && t.state === 'turn') {
    if (G.menuOpen || !$('#how').hidden) t.deadline += dt
    else if (G.t >= t.deadline) silence()
  }
  const tm = $('#timer')
  if (t && t.state === 'turn' && G.mode === 'play') tm.style.transform = `scaleX(${Math.max(0, (t.deadline - G.t) / NUM.TURN_SEC)})`; else tm.style.transform = 'scaleX(0)'
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
    const text = u.shareText(G.sales, G.bottles, u.rankName[r.rk])
    open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.github.io/job-host/'), '_blank')
  })
  // 卓の持ち物を押すと、もう一度しぐさを読める
  cv.addEventListener('pointerdown', e => {
    const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn' || !t.item) return
    const { s, ox, oy } = VIEW, X = (e.clientX - ox) / s, Y = (e.clientY - oy) / s
    if (Y > 780 && Y < 960 && Math.abs(X - 575) < 90) setClue(tx(t.item)); else if (t.walletItem && Y > 780 && Y < 960 && Math.abs(X - 770) < 90) setClue(tx(t.walletItem))
  })
  window.addEventListener('resize', resize)
  document.addEventListener('click', e => { if (e.target && e.target.id === 'tmSupport') window.TM && TM.support() })
}
function muteIcon() { $('#icoSnd').style.opacity = Snd.muted ? .35 : 1; $('#bMute').setAttribute('aria-pressed', Snd.muted ? 'true' : 'false') }

// ---------- 検証の窓口
window.HC = {
  G, D, NUM, Snd, buildNight, choose, offerBottle, ura, openMenu, closeMenu, callEnd, stopOk, result, rankOf, IMG, drawScene,
  start: (seed, o) => startNight(seed, o),
  state: () => { const t = G.tb; return { mode: G.mode, idx: G.idx, phase: t ? t.state : null, turn: t ? t.turn : 0, mood: t ? t.mood : null, k: t ? t.g.k : null, gag: t ? t.gag || null : null, senpai: !!(t && t.senpai), clueKey: t ? t.clue0.i : null, forms: t && t.choices ? t.choices.map(c => c.form) : [], att: t ? attKey(t.mood) : null, prev: t ? t.prev : null, texts: t && t.choices ? t.choices.map(c => c.text.ja) : [], used: t ? [...t.used] : [], helloTag: t ? t.helloTag : null, checked: !!(t && t.checked), young: !!(t && t.g.young), itemKey: t && t.item ? t.item.i : null, gestureKey: t ? t.gesture.k : null, walletKey: t && t.walletItem ? t.walletItem.i : null, choices: t && t.choices ? t.choices.map(c => c.tag) : [], sales: G.sales, noms: G.noms, bottles: G.bottles, ended: G.ended, warns: G.warns, fines: G.fines, helps: G.helps, minors: G.minors, bubble: $('#bubble').hidden ? null : $('#bubble').textContent, clue: $('#clue').hidden ? null : $('#clue').textContent, rk: G.result ? G.result.rk : null, net: G.total ? G.total.net : null } },
  dbg: { jump: i => { G.tasks = []; G.bossVis = null; G.mode = 'play'; G.idx = i - 1; G.tb = null; hideAll(); nextTable() }, pause: p => { paused = p }, step: n => { for (let i = 0; i < n; i++) step(1 / 60); render() }, render },
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
