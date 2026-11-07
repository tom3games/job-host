// 見た目の確認。node shot.mjs（音は出さない）。全画面を撮って shots/ に置く
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5864, SZ = (process.argv[2] || '390x844').split('x').map(Number)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: SZ[0], height: SZ[1] }, deviceScaleFactor: 2, hasTouch: true }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => m.type() === 'error' && console.log('ERR', m.text()))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600)
const n = SZ.join('x'), shot = name => p.screenshot({ path: `${ROOT}/shots/${n}-${name}.png` })
await shot('title')
await p.click('#bHow'); await shot('how'); await p.click('#howBtn')
await p.click('#bStart'); await p.waitForTimeout(300); await shot('intro'); await p.click('#bSaySkip')
await p.evaluate(() => HC.dbg.pause(true))
const run = (f = 60) => p.evaluate(f => HC.dbg.step(f), f)
await run(100); await p.waitForTimeout(100); await shot('t1')
await p.evaluate(() => { HC.choose(HC.state().choices.indexOf(HC.G.tb.main) >= 0 ? HC.state().choices.indexOf(HC.G.tb.main) : 0) }); await run(5); await shot('react')
await run(200); await p.evaluate(() => { HC.G.tb.mood = 90; HC.openMenu() }); await run(2); await shot('menu')
await p.evaluate(() => { HC.closeMenu(); HC.G.tb.wallet = 'rich'; HC.G.tb.walletYen = 500000; HC.offerBottle(2) }); await run(50); await p.waitForTimeout(100); await shot('call0')
await run(60); await p.waitForTimeout(500); await shot('call1'); await run(120); await p.waitForTimeout(100); await shot('call2')
await p.evaluate(() => HC.callEnd()); await run(10)
const toTurn = async () => { for (let i = 0; i < 300; i++) { const st = await p.evaluate(() => { HC.dbg.step(10); return HC.state() }); if (st.phase === 'turn' && st.mode === 'play') return } }
await toTurn(); await p.evaluate(() => { HC.G.warns = 0; HC.ura('love') }); await run(5); await p.waitForTimeout(350); await shot('stop'); await p.evaluate(() => HC.stopOk()); await toTurn()
await p.evaluate(() => HC.ura('tsuke')); await run(130); await p.waitForTimeout(250); await shot('raid')
await p.evaluate(() => HC.result()); await run(40); await p.waitForTimeout(100); await shot('slip-before'); await run(100); await p.waitForTimeout(100); await shot('slip-raid')
// 卓ごとの客とテーブルの様子
await p.evaluate(() => HC.start(11, { skipIntro: true })); await run(170); await shot('seed11')
await b.close(); srv.kill(); console.log('ok')
