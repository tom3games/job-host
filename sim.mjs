// 遊び方ごとの「この客に使わせた額」と手取りの分布。node sim.mjs [回数]（音は出さない）
// 客ごとに種を変えて N 回ずつ。人間の速さ: 読む bot は1手ごとに1.5〜3秒かけて押す（くじ）
// 読むbotは画面に出ている物だけを使う: 卓の持ち物2つ（itemsW）としぐさ（gestW）・財布の持ち物・事件の状況の一行・事件の選択肢
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const N = +(process.argv[2] || 12), PORT = 5863, ONLY = process.env.ONLYBOTS?.split(','), GUESTS = process.env.GUESTS?.split(',')
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
await ctx.addInitScript(() => { try { localStorage.setItem('jh_played', '1'); localStorage.setItem('jh_tut_i', '1'); localStorage.setItem('jh_tut', '1') } catch (e) {} })
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady)
// 共通の部品（文字列で bot に渡す）
const LIB = `
  const guess = () => { let w = ['l','j','p','q','s']; for (const s of s_.itemsW) w = w.filter(x => s.includes(x)); if (w.length > 1 && s_.gestW) { const v = w.filter(x => s_.gestW.includes(x)); if (v.length) w = v } return w[0] }
  const budget = s_.wallet === 'cards' ? 1500000 : s_.wallet === 'coupons' || s_.gag === 'tax' ? 150000 : 450000
  const next = HC.D.BOTTLE[s_.tier], canPay = next && s_.sales + next.yen <= budget && !s_.said
  const pickStyle = st => { const i = s_.styles.indexOf(st); return i }
  const polite = t => (t.match(/です|ます|ください|ましょう|ませ/g) || []).length * 100 + t.length
  // 事件の答え。want は推理した本音
  const evAnswer = (want) => { const e = s_.ev, E = HC.D.EVENTS[e.k]
    if (e.cue) return E.cues.find(c => c.k === e.cue).ok
    if (E.ok === 'want') return E.okWant[want] || E.okElse
    return E.ok }
`
const BOTS = {
  // 読む: 持ち物としぐさで本音を絞り、乗ってきたら財布の範囲でボトル。事件も読んでさばく
  read: { talk: `if (s_.young && !s_.checked && s_.styles.includes('i')) return HC.choose(s_.styles.indexOf('i')); if (s_.ready && canPay) return HC.offerBottle(); const i = pickStyle(guess()); HC.choose(i < 0 ? 0 : i)`, ev: true },
  // 事件を無視する（会話は読む）。売上は会話で取り返せるので、損は手取り（お詫び・クリーニング代・手当なし）に出る
  ignoreEv: { talk: `if (s_.young && !s_.checked && s_.styles.includes('i')) return HC.choose(s_.styles.indexOf('i')); if (s_.ready && canPay) return HC.offerBottle(); const i = pickStyle(guess()); HC.choose(i < 0 ? 0 : i)`, ev: false },
  // 時間切れ: 読むが、毎回押すのが遅い（6〜8秒）
  slow: { talk: `if (s_.ready && canPay) return HC.offerBottle(); const i = pickStyle(guess()); HC.choose(i < 0 ? 0 : i)`, ev: true, delay: [6, 8] },
  // 手がかりを見ずに、いつも同じ型（聞く／気遣う）。事件は決まった答えだけ分かる
  alwaysL: { talk: `if (s_.ready && canPay) return HC.offerBottle(); const i = pickStyle('l'); HC.choose(i < 0 ? 0 : i)`, ev: true, want: 'l' },
  alwaysQ: { talk: `if (s_.ready && canPay) return HC.offerBottle(); const i = pickStyle('q'); HC.choose(i < 0 ? 0 : i)`, ev: true, want: 'q' },
  // 口調で選ぶ: 一番丁寧そうな札
  tone: { talk: `if (s_.ready && canPay) return HC.offerBottle(); let b = 0; s_.texts.forEach((t, i) => { if (polite(t) > polite(s_.texts[b])) b = i }); HC.choose(b)`, ev: true, want: 'q' },
  // 毎回、当たり以外を選ぶ
  notHit: { talk: `if (s_.ready && canPay) return HC.offerBottle(); const c = s_.grades.map((g, i) => g !== 'H' ? i : -1).filter(i => i >= 0); HC.choose(c[(mem.r() * c.length) | 0])`, ev: true },
  // 読むが財布を見ない
  squeeze: { talk: `if (s_.ready && s_.tier < 4) return HC.offerBottle(); const i = pickStyle(guess()); HC.choose(i < 0 ? 0 : i)`, ev: true },
  bottleNow: { talk: `HC.offerBottle()`, ev: true },
  love: { talk: `HC.ura(mem.r() < .5 ? 'love' : 'tsuke')`, ev: true },
  nothing: { talk: ``, ev: false },
  random: { talk: `if (mem.r() < .25) HC.offerBottle(); else HC.choose((mem.r() * 3) | 0)`, ev: true },
}
const keys = await p.evaluate(() => HC.T.GUESTS.map(g => g.k))
const table = {}
for (const k of keys) {
  if (GUESTS && !GUESTS.includes(k)) continue
  table[k] = {}
  for (const [name, bot] of Object.entries(BOTS)) {
    if (ONLY && !ONLY.includes(name)) continue
    const res = []
    for (let seed = 1; seed <= N; seed++) {
      res.push(await p.evaluate(([LIB, bot, seed, k]) => {
        HC.dbg.pause(true); HC.start(seed * 7919, { skipIntro: true, guest: k })
        let rs = seed * 991 + 7; const mem = { r: () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296 } }
        const talk = new Function('s_', 'mem', LIB + bot.talk), lib = new Function('s_', LIB + 'return { guess, evAnswer }')
        const [d0, d1] = bot.delay || [1.5, 3]
        let wait = 0, g = 0, lastK = '', t0 = HC.G.t, mashAt = 0
        while (g++ < 200000) {
          HC.dbg.step(6); const s = HC.state()
          if (s.mode === 'stop') { HC.stopOk(); continue }
          if (s.mode === 'call') continue
          if (s.mode === 'raid' || s.mode === 'end') break
          const key = s.mode + ':' + s.ex + ':' + s.kind + ':' + s.phase + ':' + s.bottles + ':' + s.strikes + ':' + s.warns + ':' + s.checked + ':' + (s.ev ? s.ev.k + s.ev.shown : '')
          if (s.mode === 'event') {
            if (!bot.ev || s.ev.state !== 'on') { lastK = key; continue }
            if (key !== lastK) { lastK = key; wait = Math.round((s.ev.kind === 'mash' ? 0.6 : s.ev.kind === 'quick' ? 0.5 : d0 + mem.r() * (d1 - d0)) * 10) }
            if (wait-- > 0) continue
            if (s.ev.kind === 'mash') { if (HC.G.t - mashAt >= 0.2) { HC.choose(0); mashAt = HC.G.t } continue }
            if (s.ev.kind === 'quick') { if (s.ev.shown) HC.choose(0); continue }
            const L = lib(s), want = bot.want || L.guess(); HC.choose(s.ev.opts.indexOf(L.evAnswer(want))); continue
          }
          if (s.mode !== 'play' || s.phase !== 'turn') { lastK = key; continue }
          if (key !== lastK) { lastK = key; wait = Math.round((d0 + mem.r() * (d1 - d0)) * 10) }
          if (wait-- > 0) continue
          if (!bot.talk) continue
          talk(s, mem); lastK = ''
        }
        const secs = HC.G.t - t0
        if (HC.state().mode === 'raid') HC.result()
        HC.dbg.step(150); const s = HC.state()
        return { sales: s.sales, rk: s.rk, net: s.net, bottles: s.bottles, ex: s.ex, happy: s.happy, ended: s.ended, secs: Math.round(secs), evOk: s.evOk, evAll: s.evAll, silent: s.silent, hits: s.hits, misses: s.misses, log: HC.G.log.join(' ') }
      }, [LIB, bot, seed, k]))
    }
    if (process.env.LOG) res.forEach((r, i) => console.log(' ', k, name, i + 1, JSON.stringify(r)))
    const tally = {}; for (const r of res) tally[r.rk] = (tally[r.rk] || 0) + 1
    const avg = f => Math.round(res.reduce((a, r) => a + f(r), 0) / res.length)
    table[k][name] = { avg: avg(r => r.sales), min: Math.min(...res.map(r => r.sales)), max: Math.max(...res.map(r => r.sales)), net: avg(r => r.net), bottles: +(res.reduce((a, r) => a + r.bottles, 0) / N).toFixed(1), ex: +(res.reduce((a, r) => a + r.ex, 0) / N).toFixed(1), secs: avg(r => r.secs), ev: `${res.reduce((a, r) => a + r.evOk, 0)}/${res.reduce((a, r) => a + r.evAll, 0)}`, silent: +(res.reduce((a, r) => a + r.silent, 0) / N).toFixed(1), hit: +(res.reduce((a, r) => a + r.hits, 0) / Math.max(1, res.reduce((a, r) => a + r.hits + r.misses, 0))).toFixed(2), tally }
  }
  const row = table[k]; console.log(k.padEnd(8), Object.entries(row).map(([n, v]) => `${n}=${(v.avg / 1000) | 0}k`).join(' '))
}
// 表と合否
const bots = Object.keys(BOTS).filter(n => !ONLY || ONLY.includes(n))
const fmt = v => `${Math.round(v.avg / 1000)}k/${Math.round(v.net / 1000)}k`
console.log('\n売上/手取り（千円）')
console.log('客      | ' + bots.map(n => n.padStart(11)).join(' | '))
for (const [k, row] of Object.entries(table)) console.log(k.padEnd(8) + '| ' + bots.map(n => (row[n] ? fmt(row[n]) : '-').padStart(11)).join(' | '))
const tot = n => { const v = Object.values(table).map(r => r[n]).filter(Boolean); return { avg: v.reduce((a, r) => a + r.avg, 0) / v.length, net: v.reduce((a, r) => a + r.net, 0) / v.length } }
console.log('平均    | ' + bots.map(n => fmt(tot(n)).padStart(11)).join(' | '))
console.log('\n当たり率・事件・無言・長さ')
for (const n of bots) { const v = Object.values(table).map(r => r[n]).filter(Boolean); const ev = v.map(r => r.ev.split('/').map(Number)).reduce((a, x) => [a[0] + x[0], a[1] + x[1]], [0, 0]); console.log(`  ${n.padEnd(10)} 当たり率${(v.reduce((a, r) => a + r.hit, 0) / v.length).toFixed(2)} 事件${ev[0]}/${ev[1]} 無言${(v.reduce((a, r) => a + r.silent, 0) / v.length).toFixed(1)}回 ${Math.round(v.reduce((a, r) => a + r.secs, 0) / v.length)}秒`) }
const fails = []
for (const [k, row] of Object.entries(table)) {
  if (row.read) for (const n of bots) if (n !== 'read' && row[n] && row[n].avg > row.read.avg) fails.push(`${k}: ${n} (${row[n].avg}) が read (${row.read.avg}) より稼いだ`)
  if (row.read && row.ignoreEv && row.ignoreEv.net >= row.read.net) fails.push(`${k}: 事件を無視しても手取りが減らない ${row.ignoreEv.net} >= ${row.read.net}`)
  if (row.love && (row.love.tally.raid || 0) !== N) fails.push(`${k}: love が全回営業停止になっていない ${JSON.stringify(row.love.tally)}`)
  for (const n of ['nothing', 'slow']) if (row[n] && (row[n].max !== 0 || (row[n].tally.zero || 0) + (row[n].tally.catch || 0) !== N)) fails.push(`${k}: ${n} が最低（売上0・クビ）でない ${JSON.stringify(row[n].tally)} max=${row[n].max}`)
}
if (table && Object.values(table)[0]?.read) {
  const r = tot('read')
  for (const n of ['alwaysL', 'alwaysQ', 'tone']) if (bots.includes(n) && tot(n).avg > r.avg * 0.5) fails.push(`${n} の平均売上が read の半分を超えた (${Math.round(tot(n).avg)} / ${Math.round(r.avg)})`)
  if (bots.includes('ignoreEv') && tot('ignoreEv').net > r.net * 0.9) fails.push(`ignoreEv の手取りが read の9割以上 (${Math.round(tot('ignoreEv').net)} / ${Math.round(r.net)})`)
  const all = Object.values(table).map(r => r.read)
  console.log(`\nread: 1回の長さ 平均${Math.round(all.reduce((a, r) => a + r.secs, 0) / all.length)}秒（会話の往復 ${(all.reduce((a, r) => a + r.ex, 0) / all.length).toFixed(1)}）`)
  for (const [k, r] of Object.entries(table)) console.log(`  ${k.padEnd(8)} read: 平均${r.read.avg} 最低${r.read.min} 最高${r.read.max} 往復${r.read.ex} ${r.read.secs}秒 事件${r.read.ev} ${JSON.stringify(r.read.tally)}`)
}
console.log(fails.length ? '\nNG\n' + fails.join('\n') : '\nOK: どの客でも read が最も稼ぎ、事件を無視すると手取りが減り、同じ型・口調で選ぶと大きく負け、時間切れと何もしないは売上0でクビ、色恋連打は全回営業停止')
await b.close(); srv.kill()
process.exit(fails.length ? 1 : 0)
