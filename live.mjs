import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// job-host __NS__ を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = process.env.URL || 'https://tom3games.github.io/job-host/'
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
  // 遊びの通し: 入店 → 客の一言と3択が出る → 1つ選ぶ（往復が1つ進む）→ 明細
  if (opts.hasTouch) await p.tap('#bStart'); else await p.click('#bStart')
  await p.waitForSelector('#bSaySkip', { state: 'visible', timeout: 15000 }); if (opts.hasTouch) await p.tap('#bSaySkip'); else await p.click('#bSaySkip')
  await p.waitForFunction(() => [...document.querySelectorAll('#cards button')].filter(b => b.textContent.trim()).length === 3, null, { timeout: 30000 })
  const cards = await p.evaluate(() => [...document.querySelectorAll('#cards button')].map(b => b.textContent.trim()))
  await p.screenshot({ path: `shots/live-${name}-play.png` })
  const line = await p.evaluate(() => HC.state().line)
  // v3: 制限時間（泡）が出ていて、バーの部品は無い。卓に本音の持ち物が2つ
  const v3 = await p.evaluate(() => { const s = HC.state(); return { limit: +(s.limit || 0).toFixed(1), foam: +s.foam.toFixed(2), items: s.items.length, bar: !!document.querySelector('#timer'), ev: HC.G.tb.evQ.length } })
  if (!(v3.limit >= 3.8 && v3.foam > 0 && v3.items === 2 && !v3.bar && v3.ev >= 2)) errs.push('v3 ' + JSON.stringify(v3))
  if (opts.hasTouch) await p.tap('#cards button'); else await p.click('#cards button')
  await p.waitForFunction(() => HC.state().ex >= 1, null, { timeout: 15000 })
  const moved = await p.evaluate(() => HC.state().ex)
  await p.evaluate(() => { HC.result() }); await p.waitForTimeout(6000)
  const end = await p.evaluate(() => ({ again: document.querySelector('#bAgain')?.textContent, sup: !!document.getElementById('tmSupport'), mute: window.__muteOk && window.__muteOk() }))
  // 事件を1つ割り込ませて、さばけるか
  await p.evaluate(() => HC.start(2, { skipIntro: true, guest: 'g1' })); await p.waitForFunction(() => HC.state().phase === 'turn' && HC.state().mode === 'play', null, { timeout: 15000 })
  const evr = await p.evaluate(() => { HC.forceEvent('shimei'); const s = HC.state(); HC.choose(s.ev.opts.indexOf('stay')); return { ok: HC.G.evOk, b: document.querySelector('#bubble').textContent } })
  await p.screenshot({ path: `shots/live-${name}-event.png` })
  out.push(`${name}: line=${line} cards=${cards.join(' / ')} ex=${moved} v3=${JSON.stringify(v3)} event=${JSON.stringify(evr)} end=${JSON.stringify(end)}`)
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
