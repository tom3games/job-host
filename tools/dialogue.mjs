// 会話の全文を Markdown に書き出し、形を検算する。node tools/dialogue.mjs [出力先.md]
// 検算: 1歩に H/W/M が1つずつ・当たりの型が本音（または深掘り・挽回・身分証）・外しの型は本音でない・文字数
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
const ROOT = new URL('..', import.meta.url).pathname
const ctx = { window: {} }; vm.createContext(ctx)
vm.runInContext(readFileSync(ROOT + 'talk.js', 'utf8'), ctx)
vm.runInContext(readFileSync(ROOT + 'data.js', 'utf8'), ctx)
const T = ctx.window.HT, D = ctx.window.HD
const STYLE = { p: '細部を褒める', l: '聞く', j: '笑わせる', q: '先回り・気遣い', d: '深掘り', r: '挽回', h: '誰にでも言える', n: '持ちネタ', i: '身分証', x: '自分の都合・失礼' }
const GRADE = { H: '当たり', W: '弱い', M: '外す' }
const errs = []
const LIM = { line: 16, opt: 18, react: 16 }
const len = s => [...s].length
function check(g, where, st) {
  const want = st.w || g.want
  const gs = st.o.map(o => o.g).sort().join('')
  if (gs !== 'HMW') errs.push(`${g.k} ${where}: 評価が H/W/M 1つずつでない (${gs})`)
  if (st.w && !st.c) errs.push(`${g.k} ${where}: 本音が変わる一歩にしぐさが無い`)
  for (const o of st.o) {
    if (o.g === 'H' && ![want, 'd', 'r', 'i'].includes(o.st)) errs.push(`${g.k} ${where}: 当たり「${o.t.ja}」の型 ${o.st} が本音 ${want} でない`)
    if (o.g !== 'H' && [want, 'd', 'r', 'i'].includes(o.st)) errs.push(`${g.k} ${where}: 当たり以外「${o.t.ja}」が本音の型 ${o.st}`)
    if (o.g === 'W' && !['h', 'n'].includes(o.st)) errs.push(`${g.k} ${where}: 弱い「${o.t.ja}」が誰にでも言える型でない`)
    if (len(o.t.ja) > LIM.opt) errs.push(`${g.k} ${where}: 返事が長い ${len(o.t.ja)}字「${o.t.ja}」`)
    if (len(o.r.ja) > LIM.react) errs.push(`${g.k} ${where}: 反応が長い ${len(o.r.ja)}字「${o.r.ja}」`)
    if (/[ぁ-んァ-ヶ一-龠]/.test(o.t.en + o.r.en)) errs.push(`${g.k} ${where}: 英語に日本語`)
  }
  if (len(st.s.ja) > LIM.line) errs.push(`${g.k} ${where}: 一言が長い ${len(st.s.ja)}字「${st.s.ja}」`)
  if (st.c && len(st.c.ja) > 16) errs.push(`${g.k} ${where}: しぐさが長い ${len(st.c.ja)}字「${st.c.ja}」`)
}
const out = ['# 一晩だけホスト 会話の全文', '', '自動生成（tools/dialogue.mjs が talk.js から書き出す）。ゲームの中身そのもの。', '',
  '読み方: 客の一言（と、しぐさの一行）→ 3択。各択の後ろの「→」が、その返事を選んだ時の客の反応。', '当たりを選ぶと同じ話題を深掘りして次の一歩へ。外すと1回だけ「挽回」の一歩が来て、そのあと話題が変わる。', '話題の順番はくじ。1プレイは最初の一言＋話題をいくつか＋帰り際で最大11往復。', '',
  '型: ' + Object.entries(STYLE).map(([k, v]) => `${k}=${v}`).join(' / '), '']
const stepMd = (g, title, st) => {
  const want = st.w || g.want
  out.push(`**${title}** 客「${st.s.ja}」` + (st.c ? `　しぐさ:（${st.c.ja}）` : '') + (st.w ? `　→ この一歩の本音: ${STYLE[st.w]}` : ''))
  for (const o of st.o) out.push(`- ${GRADE[o.g]}［${STYLE[o.st]}］「${o.t.ja}」→「${o.r.ja}」`)
  out.push('')
}
for (const g of T.GUESTS) {
  out.push(`## ${g.name.ja}（${g.k}）`, '', `本音: ${STYLE[g.want]}／卓の持ち物: ${g.itemClue.ja}／財布: ${g.wallets.join('・')}`, '')
  check(g, '最初', g.hello); stepMd(g, '最初の一言', g.hello)
  g.topics.forEach((tp, i) => { out.push(`### 話題${i + 1}`, ''); tp.forEach((st, j) => { check(g, `話題${i + 1}-${j + 1}`, st); stepMd(g, `${j + 1}歩目`, st) }) })
  out.push('### 外した直後（1回だけ）', ''); check(g, '挽回', g.rescue); stepMd(g, '挽回', g.rescue)
  out.push('### 帰り際', ''); check(g, '帰り際', g.close); stepMd(g, '帰り際', g.close)
  const n = 1 + g.topics.reduce((a, t) => a + t.length, 0) + 1
  out.push(`（当たり続けた時の最大の往復: ${Math.min(11, n)}／書いた一歩の数: ${n + 1}）`, '')
  if (n < 8) errs.push(`${g.k}: 当たり続けても8往復に届かない (${n})`)
}
const dest = process.argv[2]
if (dest) writeFileSync(dest, out.join('\n'))
const steps = T.GUESTS.reduce((a, g) => a + 3 + g.topics.reduce((b, t) => b + t.length, 0), 0)
console.log(`客 ${T.GUESTS.length}人 / 一歩 ${steps} / 誤り ${errs.length}`)
if (errs.length) { console.log(errs.join('\n')); process.exit(1) }
