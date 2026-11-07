// 遊び方ごとの売上の分布。node sim.mjs [夜の数]（音は出さない）。読むbotは画面に出ている手がかりだけを使う（本音の値は見ない）
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const N = +(process.argv[2] || 12), PORT = 5863, ONLY = process.env.ONLYBOTS?.split(',')
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady)
// 共通: 卓の持ち物と2つ目のしぐさから本音を読む。札の種類は言葉で分かる（薄い言葉・地雷・深掘り）
const READ = `
  const IT={mirror:'praise',lipstick:'praise',brooch:'praise',medicine:'listen',phone:'listen',papers:'listen',fish:'joke',nose:'joke',ticket:'joke',book:'quiet',earbuds:'quiet',readers:'quiet',ledger:'quiet',purse:'listen'}
  const GS={g_p:'praise',g_l:'listen',g_j:'joke',g_q:'quiet'}
  const main=IT[s.itemKey], sub=s.gag==='tax'?'listen':s.gag==='oba'?'quiet':s.gag==='mom'?'praise':s.turn>=1?GS[s.gestureKey.slice(0,3)]:null
  const budget=s.gag==='oji'?500000:s.walletKey==='cards'||s.gag==='mom'?500000:(s.walletKey==='coupons'||s.walletKey==='purse')?40000:150000
  const fresh=i=>!s.used.includes(s.texts[i])
  const last=mem.tags.slice(-2), tired=t=>last.length===2&&last[0]===t&&last[1]===t
  const pickBy=f=>s.forms.findIndex((fm,i)=>f(fm,s.choices[i],i))
  const talk=()=>{
    let i=pickBy(fm=>fm==='back'); if(i<0) i=pickBy(fm=>fm==='deep')
    if(i<0) i=pickBy((fm,t,j)=>fm==='real'&&t===main&&fresh(j)&&!tired(t))
    if(i<0) i=pickBy((fm,t,j)=>fm==='real'&&t===sub&&fresh(j)&&!tired(t))
    if(i<0) i=pickBy((fm,t,j)=>fm==='hollow'&&t===main&&fresh(j))
    if(i<0) i=pickBy((fm,t,j)=>fm==='real'&&fresh(j)&&!tired(t))
    if(i<0) i=pickBy((fm,t,j)=>fm==='hollow'&&fresh(j))
    if(i<0) i=0
    mem.tags.push(s.choices[i]); HC.choose(i) }
  const left=(s.senpai?HC.NUM.HELP_TURNS:HC.NUM.TURNS)-s.turn
  const att=s.att, maxTier=att==='full'?2:att==='lean'?1:att==='warm'?0:-1
  const idFirst=()=>{ if(s.young&&!s.checked){HC.choose(s.choices.indexOf('id'));return true} return false }
`
const BOTS = {
  // 読む: しぐさで話を選び、態度で勧めどきを読み、財布の範囲で、指名が残る分だけ勧める
  read: READ + `if(idFirst())return
    if(!s.senpai){const bs=HC.D.BOTTLE,room=budget-mem.spent,goal=room>=300000?2:room>=100000?1:room>=30000?0:-1
      // 財布に合う一番高いのまで待つ。残りの手が足りなければ1つ下げる。帰り際の指名が残る分だけ
      for(let n=Math.min(maxTier,goal);n>=0;n--){const c=bs[n];const waiting=n<goal&&left>2;const after=s.mood-18+Math.max(0,left-1)*16;if(!waiting&&after>=60&&(left>1||s.mood-18>=60)){mem.spent+=c.yen;HC.offerBottle(n);return}}}
    talk()`,
  // 読むが安いのしか勧めない
  cheapOnly: READ + `if(idFirst())return
    if(!s.senpai&&maxTier>=0&&mem.spent+30000<=budget&&s.mood-18+Math.max(0,left-1)*16>=60){mem.spent+=30000;HC.offerBottle(0);return} talk()`,
  // 読むが搾り取る: 勧められるなら毎回一番高いのを勧める（財布も指名も見ない）
  squeeze: READ + `if(idFirst())return
    if(!s.senpai&&maxTier>=0){HC.offerBottle(maxTier);return} talk()`,
  // 読むが薄い: 深掘りも細部も拾わず、選ぶ話の種類は合っている（誰にでも言う言葉を優先）
  hollow: READ + `if(idFirst())return
    let i=pickBy((fm,t)=>fm==='hollow'&&t===main); if(i<0) i=pickBy(fm=>fm==='hollow'); if(i<0) i=pickBy(fm=>fm==='real');
    if(!s.senpai&&maxTier>=0){HC.offerBottle(0);return} HC.choose(i<0?0:i)`,
  // 話を変える: 種類は当てるが深掘りしない
  noDeep: READ + `if(idFirst())return
    if(!s.senpai){const bs=HC.D.BOTTLE;for(let n=maxTier;n>=0;n--){const c=bs[n];const after=s.mood-18+Math.max(0,left-1)*10;if(mem.spent+c.yen<=budget&&after>=60){mem.spent+=c.yen;HC.offerBottle(n);return}}}
    let i=pickBy((fm,t,j)=>fm==='real'&&t===main&&fresh(j)&&!tired(t)); if(i<0) i=pickBy((fm,t,j)=>fm==='real'&&t===sub&&fresh(j)&&!tired(t)); if(i<0) i=pickBy((fm,t,j)=>fm==='real'&&fresh(j)&&!tired(t)); if(i<0)i=pickBy(fm=>fm==='hollow'); if(i<0)i=0; mem.tags.push(s.choices[i]); HC.choose(i)`,
  // 口を信じる: 最初の一言の話だけする
  mouth: READ + `if(!s.senpai&&maxTier>=0){HC.offerBottle(maxTier);return} let i=pickBy((fm,t)=>fm==='real'&&t===s.helloTag); if(i<0)i=pickBy(fm=>fm==='hollow'); HC.choose(i<0?0:i)`,
  // 全部褒める・全部聞く・全部持ちネタ・全部先回り（勧めどきは読める）
  praise: READ + `if(!s.senpai&&maxTier>=0){HC.offerBottle(0);return} let i=s.choices.indexOf('praise'); HC.choose(i<0?0:i)`,
  listen: READ + `if(!s.senpai&&maxTier>=0){HC.offerBottle(0);return} let i=s.choices.indexOf('listen'); HC.choose(i<0?0:i)`,
  joke: READ + `if(!s.senpai&&maxTier>=0){HC.offerBottle(0);return} let i=s.choices.indexOf('joke'); HC.choose(i<0?0:i)`,
  quiet: READ + `if(!s.senpai&&maxTier>=0){HC.offerBottle(0);return} let i=s.choices.indexOf('quiet'); HC.choose(i<0?0:i)`,
  // わざと滑って挽回を狙う
  slip: READ + `if(idFirst())return
    let i=pickBy(fm=>fm==='back'); if(i<0&&(s.turn===0||mem.tags.length===0)){const r=s.choices.findIndex(t=>t!==main&&t!==sub&&t!=='deep'&&t!=='mine');i=r} if(i<0)i=pickBy(fm=>fm==='deep'); if(i<0)i=pickBy((fm,t,j)=>fm==='real'&&t===main&&fresh(j)&&!tired(t)); if(i<0)i=0
    if(!s.senpai&&maxTier>=0&&mem.spent<budget){const n=Math.min(maxTier,budget>=500000?2:budget>=150000?1:0);mem.spent+=HC.D.BOTTLE[n].yen;HC.offerBottle(n);return}
    mem.tags.push(s.choices[i]); HC.choose(i)`,
  bottleNow: `HC.offerBottle(mem.r()<.5?2:0)`,
  love: `HC.ura(mem.r()<.5?'love':'tsuke')`,
  nothing: ``,
  random: `if(mem.r()<.25){HC.offerBottle((mem.r()*3)|0)}else HC.choose((mem.r()*3)|0)`,
}
const out = {}
for (const [name, pol] of Object.entries(BOTS)) {
  if (ONLY && !ONLY.includes(name)) continue
  const res = []
  for (let seed = 1; seed <= N; seed++) {
    res.push(await p.evaluate(([pol, seed, name]) => {
      HC.dbg.pause(true); HC.start(seed, { skipIntro: true })
      const process_log = () => HC.G.log.join(' ').slice(0, 800)
      const f = new Function('s', 'mem', pol)
      let rs = seed * 991; const mem = { tags: [], spent: 0, idx: -1, r: () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296 } }
      let wait = 0, g = 0, lastK = ''
      while (g++ < 200000) {
        HC.dbg.step(6); const s = HC.state()
        if (s.mode === 'stop') { HC.stopOk(); continue }
        if (s.mode === 'raid' || s.mode === 'end') break
        if (s.idx !== mem.idx) { mem.idx = s.idx; mem.tags = []; mem.spent = 0 }
        const k = s.idx + ':' + s.turn + ':' + s.phase
        if (s.mode !== 'play' || s.phase !== 'turn') { lastK = k; continue }
        if (k !== lastK) { lastK = k; wait = 50 } // 人間の速さ: 1手5秒（6フレーム×50）
        if (wait-- > 0) continue
        if (name === 'nothing') continue
        f(s, mem)
      }
      if (HC.state().mode === 'raid') HC.result()
      HC.dbg.step(150); const s = HC.state()
      return { sales: s.sales, rk: s.rk, net: s.net, noms: s.noms, bottles: s.bottles, fines: s.fines, warns: s.warns, gags: HC.G.night.map(t => t.gag || (t.senpai ? 'S' : '-')).join(''), log: process_log() }
    }, [pol, seed, name]))
  }
  if (process.env.LOG) res.forEach((r, i) => console.log(' ', i + 1, JSON.stringify(r)))
  const tally = {}; for (const r of res) tally[r.rk] = (tally[r.rk] || 0) + 1
  const avg = k => Math.round(res.reduce((a, r) => a + r[k], 0) / N)
  out[name] = { avgSales: avg('sales'), min: Math.min(...res.map(r => r.sales)), max: Math.max(...res.map(r => r.sales)), avgNet: avg('net'), noms: +(res.reduce((a, r) => a + r.noms, 0) / N).toFixed(1), bottles: +(res.reduce((a, r) => a + r.bottles, 0) / N).toFixed(1), tally }
  console.log(name.padEnd(10), JSON.stringify(out[name]))
}
await b.close(); srv.kill()
