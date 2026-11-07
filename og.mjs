// SNS用サムネ og.png（1200x630）。node og.mjs（音は出さない）。元カレ来店の事件の瞬間＋タイトル
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname, PORT = 5866
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady); await p.waitForFunction(() => window.__hcAll); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
await p.addStyleTag({ content: `#corner,#slipHud{display:none!important} #hand{visibility:hidden!important;height:0!important;padding:0!important} #cv{transform:translateX(-290px)}
 #bubble{left:330px!important;top:300px!important;font-size:30px!important;padding:12px 24px!important;max-width:none!important}` })
await p.evaluate(() => {
  localStorage.setItem('jh_tut_i', '1'); localStorage.setItem('jh_played', '1')
  document.querySelector('#loading').style.display = 'none'
  HC.dbg.pause(true); HC.start(5, { skipIntro: true, guest: 'g2', want: 'p' })
  for (let i = 0; i < 300; i++) { HC.dbg.step(5); if (HC.state().phase === 'turn' && HC.state().mode === 'play') break }
  HC.G.tb.mood = 62; HC.forceEvent('ex', 'gf'); HC.dbg.step(40)
  HC.G.tb.reactFx = { kind: 'c', at: HC.G.t, hold: true }; HC.dbg.step(1)
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:0;top:0;bottom:0;width:560px;z-index:90;background:linear-gradient(90deg,rgba(11,7,8,0),rgba(11,7,8,.88) 18%,#0b0708 40%);display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding:0 44px 0 0;text-align:right'
  d.innerHTML = `<div style="font-family:'Zen Kaku Gothic New';font-weight:700;font-size:22px;letter-spacing:.14em;color:#d9b45f">1日だけ職場体験 #5</div>
   <div style="font-family:'Zen Antique',serif;font-size:84px;line-height:1.08;color:#fff4d6;text-shadow:0 0 2px #fff,0 0 14px rgba(255,190,90,.95),0 0 38px rgba(255,120,60,.6)">一晩だけ<br><span style="color:#ff9fa8;text-shadow:0 0 2px #fff,0 0 14px rgba(255,90,110,.95),0 0 38px rgba(220,30,60,.6)">ホスト</span></div>
   <div style="margin-top:22px;font-family:'Zen Old Mincho',serif;font-weight:900;font-size:30px;line-height:1.45;color:#f4dc9a">元カレ来店。<br>泡が消える前に、どうする？</div>
   <div style="margin-top:18px;display:flex;flex-direction:column;gap:8px;align-items:flex-end">
     <div style="background:#3a0f16;outline:2px solid #ff8a7e;color:#fff;font-family:'Zen Kaku Gothic New';font-weight:900;font-size:22px;padding:8px 16px">メニューで顔を隠してあげる</div>
     <div style="background:#3a0f16;outline:2px solid #ff8a7e;color:#fff;font-family:'Zen Kaku Gothic New';font-weight:900;font-size:22px;padding:8px 16px">堂々と乾杯して見せつける</div></div>`
  document.body.appendChild(d)
})
await p.waitForTimeout(300)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill(); console.log('ok')
