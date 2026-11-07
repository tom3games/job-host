import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// job-host __NS__ を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/job-host/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => window.__hcReady, null, { timeout: 45000 })
  // 遊びの通し: 入店 → 選択肢が出る → 1枚選ぶ → 明細
  if (opts.hasTouch) await p.tap('#bStart'); else await p.click('#bStart')
  await p.waitForSelector('#bSaySkip', { state: 'visible', timeout: 15000 }); if (opts.hasTouch) await p.tap('#bSaySkip'); else await p.click('#bSaySkip')
  await p.waitForFunction(() => [...document.querySelectorAll('#cards button')].filter(b => b.textContent.trim()).length === 3, null, { timeout: 30000 })
  const cards = await p.evaluate(() => [...document.querySelectorAll('#cards button')].map(b => b.textContent.trim()))
  await p.screenshot({ path: `shots/live-${name}-play.png` })
  if (opts.hasTouch) await p.tap('#cards button'); else await p.click('#cards button')
  await p.waitForTimeout(1200)
  const moved = await p.evaluate(() => HC.state().turn)
  await p.evaluate(() => { HC.result() }); await p.waitForTimeout(6000)
  const end = await p.evaluate(() => ({ again: document.querySelector('#bAgain')?.textContent, sup: !!document.getElementById('tmSupport'), mute: window.__muteOk && window.__muteOk() }))
  out.push(`${name}: cards=${cards.join(' / ')} turn=${moved} end=${JSON.stringify(end)}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/job-host', 'https://github.com/tom3games/job-host/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
