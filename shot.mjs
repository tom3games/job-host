// 見た目の確認。node shot.mjs [幅x高さ]（音は出さない）。全画面を撮って shots/ に置く
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5864, SZ = (process.argv[2] || '390x844').split('x').map(Number)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: SZ[0], height: SZ[1] }, deviceScaleFactor: 2, hasTouch: true }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => m.type() === 'error' && console.log('ERR', m.text()))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600)
const n = SZ.join('x'), shot = name => p.screenshot({ path: `${ROOT}/shots/${n}-${name}.png` })
const run = (f = 60) => p.evaluate(f => HC.dbg.step(f), f)
const toTurn = async () => { for (let i = 0; i < 400; i++) { const st = await p.evaluate(() => { HC.dbg.step(10); return HC.state() }); if (st.phase === 'turn' && st.mode === 'play') return st } }
await shot('title')
await p.click('#bHow'); await shot('how'); await p.click('#howBtn')
await p.click('#bStart'); await p.waitForTimeout(300); await shot('intro')
await p.evaluate(() => { HC.dbg.pause(true); HC.start(3, { skipIntro: true, guest: 'g3' }) }); await toTurn(); await run(30); await p.waitForTimeout(100); await shot('t1')
await p.evaluate(() => HC.choose(HC.state().grades.indexOf('H'))); await run(20); await shot('react')
await toTurn(); await run(30); await shot('t2')
await p.evaluate(() => HC.choose(HC.state().grades.indexOf('M'))); await toTurn(); await run(30); await shot('rescue')
await p.evaluate(() => { HC.G.tb.mood = 70; HC.openMenu() }); await run(2); await shot('menu')
await p.evaluate(() => { HC.closeMenu(); HC.offerBottle() }); await run(110); await p.waitForTimeout(100); await shot('call0')
await run(60); await p.waitForTimeout(500); await shot('call1'); await run(120); await p.waitForTimeout(100); await shot('call2')
await p.evaluate(() => HC.callEnd()); await toTurn(); await run(30); await shot('after-call')
await p.evaluate(() => HC.ura('love')); await run(5); await p.waitForTimeout(350); await shot('stop'); await p.evaluate(() => HC.stopOk()); await toTurn()
await p.evaluate(() => HC.ura('tsuke')); await run(130); await p.waitForTimeout(250); await shot('raid')
await p.evaluate(() => HC.result()); await run(40); await p.waitForTimeout(100); await shot('slip-before'); await run(100); await p.waitForTimeout(100); await shot('slip-raid')
// 客ごとの最初の一言と卓の様子
for (const k of ['g1', 'g2', 'g4', 'g5', 'g6', 'x_tax', 'x_oba', 'x_oji', 'x_young', 'x_mom']) { await p.evaluate(k => HC.start(5, { skipIntro: true, guest: k }), k); await toTurn(); await run(40); await shot('guest-' + k) }
// 読んで通した結果の明細
await p.evaluate(() => HC.start(1, { skipIntro: true, guest: 'g5' }))
for (let i = 0; i < 3000; i++) { const s = await p.evaluate(() => { HC.dbg.step(30); return HC.state() }); if (s.mode === 'end') break; if (s.mode === 'play' && s.phase === 'turn') await p.evaluate(() => { const s = HC.state(); if (s.ready && s.tier < 3) return HC.offerBottle(); HC.choose(s.grades.indexOf('H')) }) }
await run(200); await p.waitForTimeout(150); await shot('slip-good')
await b.close(); srv.kill(); console.log('ok')
