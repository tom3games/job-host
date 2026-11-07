// 遊び方ごとの「この客に使わせた額」の分布。node sim.mjs [回数]（音は出さない）
// 客ごとに種を変えて N 回ずつ。読むbotは画面に出ている物だけを使う: 卓の持ち物・しぐさの一行（cue）・返事の言葉の種類（styles）・態度・財布の持ち物
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const N = +(process.argv[2] || 12), PORT = 5863, ONLY = process.env.ONLYBOTS?.split(','), GUESTS = process.env.GUESTS?.split(',')
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady)
// 共通: 財布は卓の持ち物で読む（カード=多い・クーポン=少ない・何も無し=普通）
const READ = `
  const budget=s.items.includes('cards')?1500000:s.items.includes('coupons')?150000:450000
  const next=HC.D.BOTTLE[s.tier], canPay=next&&s.sales+next.yen<=budget&&!s.said
  const talk=()=>{
    const ok=st=>st===s.cue||st==='d'||st==='r'||st==='i'
    let i=s.styles.findIndex(ok)
    if(i<0) i=s.styles.indexOf('h')
    if(i<0) i=s.styles.findIndex(st=>st==='n'&&!s.netaUsed)
    if(i<0) i=0
    HC.choose(i) }
  const idFirst=()=>{ if(s.young&&!s.checked){HC.checkId();return true} return false }
`
const BOTS = {
  // 読む: しぐさで返事を選び、乗ってきたら（ボトルの札が光ったら）財布の範囲で勧める
  read: READ + `if(s.ready&&canPay){ if(idFirst())return; HC.offerBottle(); return } talk()`,
  // 毎回、当たり以外を選ぶ（勧めどきと財布は読める）
  notHit: READ + `if(s.ready&&canPay){HC.offerBottle();return} const c=s.grades.map((g,i)=>g!=='H'?i:-1).filter(i=>i>=0); HC.choose(c[(mem.r()*c.length)|0])`,
  // 誰にでも言える言葉だけ
  weakOnly: READ + `if(s.ready&&canPay){HC.offerBottle();return} const i=s.styles.indexOf('h'); HC.choose(i<0?0:i)`,
  // 読むが財布を見ない: 光ったら毎回勧める
  squeeze: READ + `if(s.ready&&s.tier<4){HC.offerBottle();return} talk()`,
  // すぐボトル
  bottleNow: `HC.offerBottle()`,
  // 色恋・ツケを連打
  love: `HC.ura(mem.r()<.5?'love':'tsuke')`,
  nothing: ``,
  // 適当
  random: `if(mem.r()<.25){HC.offerBottle()}else HC.choose((mem.r()*3)|0)`,
}
const keys = await p.evaluate(() => HC.T.GUESTS.map(g => g.k))
const table = {}
for (const k of keys) {
  if (GUESTS && !GUESTS.includes(k)) continue
  table[k] = {}
  for (const [name, pol] of Object.entries(BOTS)) {
    if (ONLY && !ONLY.includes(name)) continue
    const res = []
    for (let seed = 1; seed <= N; seed++) {
      res.push(await p.evaluate(([pol, seed, name, k]) => {
        HC.dbg.pause(true); HC.start(seed * 7919, { skipIntro: true, guest: k })
        const f = new Function('s', 'mem', pol)
        let rs = seed * 991; const mem = { r: () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296 } }
        let wait = 0, g = 0, lastK = '', t0 = HC.G.t, decisions = 0
        while (g++ < 200000) {
          HC.dbg.step(6); const s = HC.state()
          if (s.mode === 'stop') { HC.stopOk(); continue }
          if (s.mode === 'call') { continue }
          if (s.mode === 'raid' || s.mode === 'end') break
          const key = s.ex + ':' + s.kind + ':' + s.phase + ':' + s.bottles + ':' + s.strikes + ':' + s.warns + ':' + s.checked
          if (s.mode !== 'play' || s.phase !== 'turn') { lastK = key; continue }
          if (key !== lastK) { lastK = key; wait = 50 } // 人間の速さ: 1手5秒（6フレーム×50）
          if (wait-- > 0) continue
          if (name === 'nothing') continue
          decisions++; f(s, mem)
        }
        const secs = HC.G.t - t0
        if (HC.state().mode === 'raid') HC.result()
        HC.dbg.step(150); const s = HC.state()
        return { sales: s.sales, rk: s.rk, net: s.net, bottles: s.bottles, ex: s.ex, happy: s.happy, ended: s.ended, secs: Math.round(secs), log: HC.G.log.join(' ') }
      }, [pol, seed, name, k]))
    }
    if (process.env.LOG) res.forEach((r, i) => console.log(' ', k, name, i + 1, JSON.stringify(r)))
    const tally = {}; for (const r of res) tally[r.rk] = (tally[r.rk] || 0) + 1
    const avg = f => Math.round(res.reduce((a, r) => a + f(r), 0) / res.length)
    table[k][name] = { avg: avg(r => r.sales), min: Math.min(...res.map(r => r.sales)), max: Math.max(...res.map(r => r.sales)), net: avg(r => r.net), bottles: +(res.reduce((a, r) => a + r.bottles, 0) / N).toFixed(1), ex: +(res.reduce((a, r) => a + r.ex, 0) / N).toFixed(1), secs: avg(r => r.secs), tally }
  }
  const row = table[k]; console.log(k.padEnd(8), Object.entries(row).map(([n, v]) => `${n}=${(v.avg / 1000) | 0}k`).join(' '))
}
// 表と合否
const bots = Object.keys(BOTS).filter(n => !ONLY || ONLY.includes(n))
console.log('\n客      | ' + bots.map(n => n.padStart(9)).join(' | '))
for (const [k, row] of Object.entries(table)) console.log(k.padEnd(8) + '| ' + bots.map(n => (row[n] ? `${Math.round(row[n].avg / 1000)}k`.padStart(9) : '-'.padStart(9))).join(' | '))
const fails = []
for (const [k, row] of Object.entries(table)) {
  if (row.read) for (const n of bots) if (n !== 'read' && row[n] && row[n].avg > row.read.avg) fails.push(`${k}: ${n} (${row[n].avg}) が read (${row.read.avg}) より稼いだ`)
  if (row.love && (row.love.tally.raid || 0) !== N) fails.push(`${k}: love が全回営業停止になっていない ${JSON.stringify(row.love.tally)}`)
  if (row.nothing && (row.nothing.max !== 0 || (row.nothing.tally.zero || 0) !== N)) fails.push(`${k}: nothing が最低（売上0・クビ）でない ${JSON.stringify(row.nothing)}`)
}
if (table && Object.values(table)[0]?.read) {
  const all = Object.values(table).map(r => r.read)
  console.log(`\nread: 1回の長さ 平均${Math.round(all.reduce((a, r) => a + r.secs, 0) / all.length)}秒（会話の往復 ${(all.reduce((a, r) => a + r.ex, 0) / all.length).toFixed(1)}）`)
  for (const [k, r] of Object.entries(table)) console.log(`  ${k.padEnd(8)} read: 平均${r.read.avg} 最低${r.read.min} 最高${r.read.max} 往復${r.read.ex} ${r.read.secs}秒 ${JSON.stringify(r.read.tally)}`)
}
console.log(fails.length ? '\nNG\n' + fails.join('\n') : '\nOK: どの客でも read が最も稼ぎ、色恋連打は全回営業停止、何もしないは売上0でクビ')
await b.close(); srv.kill()
process.exit(fails.length ? 1 : 0)
