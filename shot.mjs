// 見た目の確認。node shot.mjs [幅x高さ]（音は出さない）。全画面を撮って shots/ に置く
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5864, SZ = (process.argv[2] || '390x844').split('x').map(Number)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } }); await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: SZ[0], height: SZ[1] }, deviceScaleFactor: 2, hasTouch: true }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => m.type() === 'error' && console.log('ERR', m.text()))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady); await p.waitForFunction(() => window.__hcAll); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600)
const n = SZ.join('x'), shot = name => p.screenshot({ path: `${ROOT}/shots/${n}-${name}.png` })
const run = (f = 60) => p.evaluate(f => HC.dbg.step(f), f)
const toTurn = async () => { for (let i = 0; i < 400; i++) { const st = await p.evaluate(() => { HC.dbg.step(10); return HC.state() }); if (st.mode === 'event' && st.ev.state === 'on') await p.evaluate(() => { const s = HC.state(); HC.choose(s.ev.kind === 'two' ? s.ev.opts.indexOf(HC.evCorrect(HC.G.ev, HC.G.tb)) : 0) }); if (st.phase === 'turn' && st.mode === 'play') return st } }
const ev = async (k, cue, name, after = 40) => { await toTurn(); await p.evaluate(([k, c]) => HC.forceEvent(k, c), [k, cue]); await run(after); await p.waitForTimeout(80); await shot(name || 'ev-' + k) }
await shot('title')
await p.click('#bHow'); await shot('how'); await p.click('#howBtn')
await p.click('#bStart'); await p.waitForTimeout(300); await shot('intro')
await p.evaluate(() => { localStorage.setItem('jh_tut_i', '1'); HC.dbg.pause(true); HC.start(3, { skipIntro: true, guest: 'g1', want: 'l' }) }); await toTurn(); await run(10); await p.waitForTimeout(100); await shot('t1')
await run(330); await shot('t1-late')
await p.evaluate(() => HC.choose(HC.state().grades.indexOf('H'))); await run(30); await shot('hit')
await toTurn(); await p.evaluate(() => HC.choose(HC.state().grades.indexOf('M'))); await run(30); await shot('miss')
await toTurn(); await p.evaluate(() => HC.tapTable(HC.SPOT[0].x, 880)); await run(2); await shot('tap-item')
await ev('ex', 'gf'); await ev('ex', 'alone', 'ev-ex-alone')
await ev('spill', null, 'ev-spill'); await p.evaluate(() => { HC.choose(0); HC.choose(0); HC.choose(0) }); await run(2); await shot('ev-spill-wiping')
await ev('mom'); await ev('shimei'); await ev('senpai')
await ev('wallet', null, 'ev-wallet', 60)
await ev('photo'); await p.evaluate(() => HC.choose(HC.state().ev.opts.indexOf(HC.evCorrect(HC.G.ev, HC.G.tb)))); await run(3); await shot('ev-photo-ok')
await ev('bday'); await ev('toilet'); await ev('hoh'); await ev('pizza')
await p.evaluate(() => { HC.start(4, { skipIntro: true, guest: 'x_oji' }) }); await toTurn(); await run(20); await shot('oji')
await p.evaluate(() => HC.choose(HC.state().grades.indexOf('H'))); await run(30); await shot('oji-hit')
await p.evaluate(() => { HC.start(6, { skipIntro: true, guest: 'g6' }) })
for (let i = 0; i < 40; i++) { const s = await toTurn(); if (s.ex >= 5) break; await p.evaluate(() => HC.choose(HC.state().grades.indexOf('H'))) }
await run(20); await shot('switch')
await p.evaluate(() => { HC.G.tb.mood = 70; HC.openMenu() }); await run(2); await shot('menu')
await p.evaluate(() => { HC.closeMenu(); HC.offerBottle() }); await run(110); await p.waitForTimeout(100); await shot('call0')
await run(60); await p.waitForTimeout(500); await shot('call1')
await p.evaluate(() => HC.callEnd()); await toTurn(); await run(30); await shot('after-call')
await p.evaluate(() => HC.ura('love')); await run(5); await p.waitForTimeout(350); await shot('stop'); await p.evaluate(() => HC.stopOk()); await toTurn()
await p.evaluate(() => HC.ura('tsuke')); await run(130); await p.waitForTimeout(250); await shot('raid')
await p.evaluate(() => HC.result()); await run(150); await p.waitForTimeout(100); await shot('slip-raid')
for (const k of ['g2', 'g3', 'g4', 'g5', 'x_tax', 'x_oba', 'x_young', 'x_mom']) { await p.evaluate(k => HC.start(5, { skipIntro: true, guest: k }), k); await toTurn(); await run(40); await shot('guest-' + k) }
// 読んで通した結果の明細
await p.evaluate(() => HC.start(1, { skipIntro: true, guest: 'g5' }))
for (let i = 0; i < 3000; i++) {
  const s = await p.evaluate(() => { HC.dbg.step(30); return HC.state() }); if (s.mode === 'end') break
  if (s.mode === 'event' && s.ev.state === 'on') await p.evaluate(() => { const s = HC.state(); if (s.ev.kind === 'two') HC.choose(s.ev.opts.indexOf(HC.evCorrect(HC.G.ev, HC.G.tb))); else if (s.ev.shown) for (let i = 0; i < 8; i++) HC.choose(0) })
  if (s.mode === 'play' && s.phase === 'turn') await p.evaluate(() => { const s = HC.state(), next = HC.D.BOTTLE[s.tier]; if (s.ready && next && s.sales + next.yen <= HC.G.tb.walletYen) return HC.offerBottle(); HC.choose(s.grades.indexOf('H')) })
  if (s.mode === 'call') await p.evaluate(() => HC.callEnd())
}
await run(200); await p.waitForTimeout(150); await shot('slip-good')
await b.close(); srv.kill(); console.log('ok')
