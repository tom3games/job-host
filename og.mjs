// SNS用サムネ og.png（1200x630）。node og.mjs（音は出さない）。シャンパンコールの瞬間＋タイトル
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname, PORT = 5866
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hcReady); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
await p.evaluate(() => {
  document.querySelector('#loading').style.display = 'none'
  HC.dbg.pause(true); HC.start(1, { skipIntro: true, guest: 'g2' }); for (let i = 0; i < 12; i++) HC.dbg.step(10)
  const t = HC.G.tb; t.mood = 95; t.tier = 2; HC.offerBottle(); HC.dbg.step(90)
  for (let i = 0; i < 4; i++) HC.dbg.step(40)
})
await p.waitForTimeout(700)
await p.addStyleTag({ content: `#corner{display:none!important} #callBig{left:auto!important;right:0!important;width:640px!important;top:260px!important;font-size:72px!important;line-height:1.14!important} #callSub{left:auto!important;right:0!important;width:640px!important;top:204px!important;font-size:34px!important}
 #callCrew{left:0!important;bottom:-12%!important;width:760px!important;transform:none!important;animation:none!important} #callItem{left:372px!important;top:14px!important;height:330px!important;transform:rotate(-6deg)!important;opacity:1!important}` })
await p.evaluate(() => {
  const big = document.querySelector('#callBig'); big.classList.remove('pop'); big.textContent = '確定申告\nばっちり！'; big.style.whiteSpace = 'pre-line'
  document.querySelector('#callSub').textContent = '+¥300,000'
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:0;width:640px;top:30px;z-index:90;text-align:center;font-family:"Zen Antique",serif;color:#fff4d6'
  d.innerHTML = `<div style="font-family:'Zen Kaku Gothic New';font-weight:700;font-size:22px;letter-spacing:.14em;color:#d9b45f">1日だけ職場体験 #5</div><div style="font-size:82px;line-height:1.1;text-shadow:0 0 2px #fff,0 0 14px rgba(255,190,90,.95),0 0 38px rgba(255,120,60,.6)">一晩だけホスト</div>`
  document.body.appendChild(d)
  const f = document.createElement('div'); f.style.cssText = "position:fixed;right:0;width:640px;bottom:32px;z-index:90;text-align:center;font-family:'Zen Old Mincho',serif;font-weight:900;font-size:30px;color:#f4dc9a;text-shadow:0 2px 6px #000"; f.textContent = '1人の客に、いくら使わせる？'; document.body.appendChild(f)
  HC.dbg.step(1)
})
await p.waitForTimeout(300)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill(); console.log('ok')
