// 一晩だけホスト 本体。1プレイ＝客1人。客の一言に、その一言へ答える3択で返し、楽しませてからボトルを安い順に勧める
// 会話は talk.js に客ごとに書き下ろし。誰が来るか・話題の順番・財布は席に着く前のくじで全部決まる（同じ種なら同じ流れ）
// 描画は Canvas 2D、時間は固定60Hz（performance.now で数える）
import { drawPayslip, totals } from './payslip.js?v=2'
window.__jsUp = true
const D = window.HD, T = window.HT
const $ = s => document.querySelector(s)
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
let lang = store.get('jh_lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const L = () => D.UI[lang]
const tx = o => (o ? (o[lang] ?? o.ja) : '')
const yen = n => '¥' + Math.round(n).toLocaleString('en-US')
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---------- 釣り合いの数字（sim.mjs で確かめる）
export const NUM = { START: 30, HIT: 14, RESCUE: 18, WEAK: 3, MISS: -12, BORED: -14, SILENT: -14, PUSH: -18, SOLD: -10, STOP: -20, ID_OK: 14, NOMI_FEE: 10000, MAXEX: 11, TURN_SEC: 14, HAPPY: 60, WARN: 10000, RAID: 1000000, MINOR: 5000, NOMI: 3000, PER_BOTTLE: 1000, COMM: 0.2 }

// ---------- 画像
const V = '?v=2'
const IMG = {}
const ITEMS = ['mirror', 'brooch', 'medicine', 'ticket', 'book', 'readers', 'ledger', 'papers', 'cards', 'coupons', 'purse', 'pass']
// 最初の画面に要る物だけ待つ。コールの絵などは準備完了のあと裏で読む
const FIRST = ['bg', 's_senpai', 'b1']
const LATER = ['s_boss', 'crew', 's_naikin', 'b2', 'b3', 'tower', ...ITEMS.map(n => 'i_' + n)]
const loadImg = n => new Promise(res => { if (IMG[n]) return res(); const im = new Image(); im.onload = () => { IMG[n] = im; res() }; im.onerror = () => { console.error('img ' + n); res() }; im.src = 'img/' + n + '.webp' + V })
const HAS = new Set(['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].flatMap(k => [k, k + '_h', k + '_c']).concat(['x_tax', 'x_tax_c', 'x_oba', 'x_oba_h', 'x_oba_c', 'x_mom', 'x_mom_h', 'x_oji', 'x_oji_h', 'x_young', 'x_young_h']))
const faces = g => [g.k, g.k + '_h', g.k + '_c'].filter(n => HAS.has(n))

// ---------- 場面の座標（背景 1536x1024、人物は 640x960 に縮めてあるが 896x1344 のつもりで置く）
const SW = 1536, SH = 1024, CY = 784, CS = 0.62, IW = 896, IH = 1344

// ---------- 状態
const G = { mode: 'title', t: 0, tasks: [], tb: null, ended: null, seed: 1, snap: null, log: [], flash: 0, mom: false, callAt: 0, bottles: 0, warns: 0, minors: 0 }
const later = (d, fn) => G.tasks.push({ at: G.t + d, fn, night: G.gen })
const sayMin = s => Math.max(1.6, 0.9 + 0.09 * s.length)
const byKey = Object.fromEntries(T.GUESTS.map(g => [g.k, g]))
const lineOf = (t, k) => (t.g.lines && t.g.lines[k]) || D.LINE[k]

// ---------- 1回のくじ。同じ種なら同じ客・同じ話題の順番・同じ並び
function buildPlay(seed, guestKey) {
  const r = rng(seed), shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a }, pick = a => a[(r() * a.length) | 0]
  let g = byKey[guestKey]
  if (!g) { const ks = Object.keys(T.WEIGHT), sum = ks.reduce((a, k) => a + T.WEIGHT[k], 0); let x = r() * sum; for (const k of ks) { x -= T.WEIGHT[k]; if (x <= 0) { g = byKey[k]; break } } g = g || byKey.g1 }
  else r()
  const wallet = pick(g.wallets), w = D.WALLET[wallet]
  const t = {
    g, gag: g.gag || null, want: g.want, wallet, walletYen: w.yen, walletItem: w.i && w.i !== g.item ? w : null, item: { i: g.item },
    topics: shuffle(g.topics), minor: g.gag === 'young' ? r() < 0.5 : false, r,
    mood: NUM.START, spent: 0, tier: 0, strikes: 0, sil: 0, ex: 0, rescued: false, netaUsed: false, checked: false, happy: false,
    state: 'wait', node: null, kind: null, choices: null, ti: null, si: 0, said: false,
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
  const t = buildPlay(G.seed, opts.guest)
  Object.assign(G, { tb: t, ended: null, snap: null, log: [], tasks: [], mom: false, bottles: 0, warns: 0, minors: 0, callState: null, menuOpen: false, count: null, stampAt: null, result: null, total: null, raidKind: null, bossVis: null })
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
  later(0.8, () => { if (G.tb === t) present(t.g.hello, 'hello') })
}
// 客の一言を出して、3択を並べる。again はボトルや内勤のあとに同じ一言へ戻る時
function present(node, kind, again) {
  const t = G.tb; if (!t || t.state === 'gone') return
  t.node = node; t.kind = kind; t.state = 'turn'; t.deadline = G.t + NUM.TURN_SEC
  if (!again || !t.choices) t.choices = t.shuffle(node.o)
  say(tx(node.s)); setCards(t.choices); refreshBottle()
  // しぐさの一行。無い一歩は今の態度を見せる。最初の1回だけ勧めどきを教える
  if (node.c) setClue(tx(node.c))
  else if (kind === 'hello') setClue(tx(t.g.itemClue))
  else if (store.get('jh_tut') !== '1' && bottleReady(t)) { store.set('jh_tut', '1'); setClue(L().tut.bottle, 'tip') }
  else setClue(tx(attLine(t)))
  updateHud()
}
const attKey = m => m < 25 ? 'low' : m < 45 ? 'mid' : m < 60 ? 'warm' : m < 85 ? 'lean' : 'full'
function attLine(t) { const a = D.ATT[attKey(t.mood)]; return a[(t.ex + t.tier) % a.length] }
const bottleReady = t => t.tier < D.BOTTLE.length && t.mood >= D.BOTTLE[t.tier].need

// ---------- 会話を選ぶ
function choose(i) {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return false
  const c = t.choices[i]; if (!c) return false
  t.state = 'react'; setCards(t.choices, true); refreshBottle()
  if (c.st === 'i') return idCheck(t, true)
  let grade = c.g
  if (c.st === 'n') { if (t.netaUsed) grade = 'bored'; t.netaUsed = true }
  const d = { H: t.kind === 'rescue' ? NUM.RESCUE : NUM.HIT, W: NUM.WEAK, M: NUM.MISS, bored: NUM.BORED }[grade]
  setMood(t, d); t.sil = 0
  G.log.push(`${t.g.k}:${t.kind}:${c.st}:${grade}`)
  react(t, grade === 'bored' ? lineOf(t, 'bored') : c.r, grade === 'H' ? 'h' : grade === 'W' ? 'n' : 'c', () => advance(grade))
  return true
}
function react(t, line, face, then) {
  t.reactFx = { kind: face, at: G.t }
  if (face === 'h') Sfx('good'); else if (face === 'c') { t.shake = G.t; Sfx('bad') }
  const s = tx(line); say(s); hideClue()
  later(sayMin(s), () => { if (G.tb === t && t.state !== 'gone') then() })
}
function setMood(t, d) { t.mood = Math.max(0, Math.min(100, t.mood + d)); refreshBottle() }
const leaving = t => t.mood <= 0 || t.strikes >= 2 || t.sil >= 2
function advance(grade) {
  const t = G.tb; if (!t || t.state === 'gone') return
  t.ex++
  if (leaving(t) || t.kind === 'close') return leave()
  if (t.ex >= NUM.MAXEX - 1) return present(t.g.close, 'close')
  // 外したら1回だけ挽回の一歩へ。そのあとは話題を変える。当たれば同じ話題を深掘りする
  if (grade === 'M' || grade === 'bored' || grade === 'silent') {
    if (!t.rescued && t.kind !== 'rescue' && grade !== 'silent') { t.rescued = true; return present(t.g.rescue, 'rescue') }
    return nextTopic()
  }
  if (t.kind === 'topic' && t.si + 1 < t.ti.length) { t.si++; return present(t.ti[t.si], 'topic') }
  nextTopic()
}
function nextTopic() {
  const t = G.tb
  if (!t.topics.length || t.ex >= NUM.MAXEX - 1) return present(t.g.close, 'close')
  t.ti = t.topics.shift(); t.si = 0; present(t.ti[0], 'topic')
}
function silence() {
  const t = G.tb; t.state = 'react'; setCards(t.choices, true); t.sil++; setMood(t, NUM.SILENT); G.log.push(t.g.k + ':silent')
  const a = lineOf(t, 'silent'); react(t, Array.isArray(a) ? a[t.sil % a.length] : a, 'c', () => advance('silent'))
}
function idCheck(t, asReply) {
  t.checked = true; G.log.push(t.g.k + ':id')
  if (t.minor) {
    G.minors++; t.state = 'react'; const s = tx(t.g.lines.idNG); say(s); t.reactFx = { kind: 'c', at: G.t, hold: true }; setClue(L().minorSent); setCards(t.choices, true); refreshBottle()
    later(Math.max(2.2, sayMin(s)), () => { if (G.tb !== t) return; t.state = 'gone'; t.leaveAt = G.t; G.ended = 'catch'; later(0.8, () => { if (G.tb === t) goResult() }) })
  } else {
    setMood(t, NUM.ID_OK); Sfx('good'); t.state = 'react'; setCards(t.choices, true)
    react(t, t.g.lines.idOK, 'h', () => asReply ? advance('H') : present(t.node, t.kind, true))
  }
  return true
}

// ---------- ボトル（安い順に1本ずつ）
function offerBottle() {
  const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn' || t.tier >= D.BOTTLE.length) return false
  closeMenu(); t.state = 'react'; setCards(t.choices, true); refreshBottle()
  const n = t.tier, b = D.BOTTLE[n]; G.log.push(`${t.g.k}:bottle${n}`)
  if (t.gag === 'young' && t.minor && !t.checked) return raid('minor')
  // 楽しさを渡す前の「買って」と、財布を超える勧めは押し売り。2回で帰る
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
  closeMenu(); t.state = 'react'; setCards(t.choices, true); refreshBottle(); G.log.push(`${t.g.k}:${kind}`)
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
const honName = t => tx(t.g.name) + tx(t.g.hon)
function champagneCall(n, t) {
  const b = D.BOTTLE[n], who = honName(t)
  const pool = D.CALL.mid.slice(1), k = G.seed + G.bottles * 3
  const lines = n === 3 ? [D.CALL.tower[0], { ja: D.CALL.mid[0].ja.replace('{n}', who), en: D.CALL.mid[0].en.replace('{n}', who) }, D.CALL.tower[1], D.CALL.tower[2]]
    : [D.CALL.open[0], { ja: D.CALL.mid[0].ja.replace('{n}', who), en: D.CALL.mid[0].en.replace('{n}', who) }, pool[k % pool.length]]
  if (n === 1 || n === 2) lines.push(pool[(k + 4) % pool.length])
  if (n === 2) lines.push(pool[(k + 7) % pool.length])
  lines.push(D.CALL.last[0])
  // コールのあとは同じ一言に戻る。滑った直後の「今の何？」だけは、乾杯で流れたことにして話題を変える
  runCall({ img: b.i, sub: `+${yen(b.yen)}`, lines, big: n }, () => { if (G.tb !== t) return; if (t.kind === 'rescue') nextTopic(); else present(t.node, t.kind, true) })
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
  t.state = 'gone'; setCards(null, true); refreshBottle(); hideClue()
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
  if (G.minors) pay.push({ label: u.payMinor, note: `${G.minors}${u.unitP}`, yen: NUM.MINOR * G.minors })
  if (G.warns && !raided) ded.push({ label: u.dedWarn, note: `${G.warns}${u.unitT}`, yen: NUM.WARN * G.warns })
  if (raided) ded.push({ label: u.dedRaid, note: '', yen: NUM.RAID })
  const hours = Math.max(1, Math.ceil(t.ex / 3))
  let comment = u.comments[rk]; if (G.mom && !raided) comment = u.comments.mom
  return { lang, no: 5, job: u.job, date: '2026.11.07', wage: 1200, hours, pay, ded, boss: u.boss, comment: `${u.rankName[rk]}。${comment}`, stamp: u.ranks[rk], stampK: 0, photo: G.snap, footer: u.footer, name: u.name, rk, who, spent: t.spent }
}
function result() {
  hideAll(); G.mode = 'end'; setCards(null); const d = buildSlip(); G.result = d; G.total = totals(d)
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
  function mk() { for (let i = 0; i < 3; i++) { const b = document.createElement('button'); b.className = 'card'; b.textContent = ' '; b.disabled = true; b.addEventListener('click', () => { Snd.init(); Sfx('card'); choose(i) }); box.appendChild(b) } }
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
  if (t.gag === 'young' && !t.checked) { const e = document.createElement('button'); e.className = 'mi idb'; e.id = 'mId'; e.innerHTML = '<span></span>'; e.querySelector('span').textContent = u.idcheck; e.addEventListener('click', () => { closeMenu(); idCheck(t, false) }); box.appendChild(e) }
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
  else if (t && t.state !== 'wait') {
    const tin = ease((G.t - t.enterAt) / .6), tout = t.leaveAt != null ? ease((G.t - t.leaveAt) / .5) : 0
    a = tin * (1 - tout); dy = (1 - tin) * 26 + tout * 18 + Math.sin(G.t * 1.5) * 2.5
    if (t.shake != null && G.t - t.shake < .5) { const k = 1 - (G.t - t.shake) / .5; dx = Math.sin(G.t * 70) * 10 * k }
    personImg = IMG[faceOf(t, o.forceFace)] || IMG[t.g.k]
  }
  if (personImg && a > 0.002) { x.globalAlpha = a; G.leanK = G.leanK == null ? 1 : G.leanK; const lk = !t || !$('#vTitle').hidden ? 1 : 0.93 + 0.13 * t.mood / 100; G.leanK += (lk - G.leanK) * 0.08; const w = IW * CS * G.leanK, h = IH * CS * G.leanK; x.drawImage(personImg, 768 - w / 2 + dx, CY + 26 - 1136 * CS * G.leanK + dy, w, h); x.globalAlpha = 1 }
  // テーブルを人物の手前に描き直す
  if (bg) x.drawImage(bg, 0, CY, SW, SH - CY, 0, CY, SW, SH - CY)
  if (t && t.state !== 'wait' && $('#vTitle').hidden && a > .02) {
    x.globalAlpha = a
    if (t.item) drawItem(x, t.item.i, 575, 900, 112)
    if (t.walletItem) drawItem(x, t.walletItem.i, 770, 930, 90)
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
    const text = u.shareText(r.who, r.spent, G.bottles, u.rankName[r.rk])
    open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://tom3games.github.io/job-host/'), '_blank')
  })
  // 卓の持ち物を押すと、もう一度その持ち物の様子を読める
  cv.addEventListener('pointerdown', e => {
    const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn') return
    const { s, ox, oy } = VIEW, X = (e.clientX - ox) / s, Y = (e.clientY - oy) / s
    if (Y > 780 && Y < 960 && Math.abs(X - 575) < 90) setClue(tx(t.g.itemClue)); else if (t.walletItem && Y > 780 && Y < 960 && Math.abs(X - 770) < 90) setClue(tx(t.walletItem))
  })
  window.addEventListener('resize', resize)
  document.addEventListener('click', e => { if (e.target && e.target.id === 'tmSupport') window.TM && TM.support() })
}
function muteIcon() { $('#icoSnd').style.opacity = Snd.muted ? .35 : 1; $('#bMute').setAttribute('aria-pressed', Snd.muted ? 'true' : 'false') }

// ---------- 検証の窓口
window.HC = {
  G, D, T, NUM, Snd, buildPlay, choose, offerBottle, ura, openMenu, closeMenu, callEnd, stopOk, result, rankOf, affordable, IMG, drawScene,
  start: (seed, o) => startNight(seed, o),
  checkId: () => { const t = G.tb; if (G.mode !== 'play' || !t || t.state !== 'turn' || t.gag !== 'young' || t.checked) return false; t.state = 'react'; return idCheck(t, false) },
  // 画面に出ている物だけを返す（読むbotはここしか見ない）。grades は「当たり以外を選ぶ」bot だけが使う
  state: () => {
    const t = G.tb, c = t && t.choices, n = t && t.node
    const cue = n && n.c && n.w ? n.w : t ? T.ITEM_WANT[t.g.item] : null
    return { mode: G.mode, phase: t ? t.state : null, kind: t ? t.kind : null, ex: t ? t.ex : 0, mood: t ? t.mood : null, k: t ? t.g.k : null, gag: t ? t.gag : null, att: t ? attKey(t.mood) : null, ready: !!(t && bottleReady(t)), tier: t ? t.tier : 0, cue, walletKey: t && t.walletItem ? t.walletItem.i : null, items: t ? [t.item.i, t.walletItem && t.walletItem.i].filter(Boolean) : [], said: !!(t && t.said), netaUsed: !!(t && t.netaUsed), checked: !!(t && t.checked), young: !!(t && t.gag === 'young'),
      line: n ? n.s.ja : null, styles: c ? c.map(o => o.st) : [], grades: c ? c.map(o => o.g) : [], texts: c ? c.map(o => o.t.ja) : [], cards: [...document.querySelectorAll('#cards .card')].map(b => b.textContent),
      sales: t ? t.spent : 0, bottles: G.bottles, ended: G.ended, warns: G.warns, minors: G.minors, strikes: t ? t.strikes : 0, happy: !!(t && t.happy),
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
