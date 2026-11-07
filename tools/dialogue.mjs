// 会話と事件の全文を Markdown に書き出し、形を検算する。node tools/dialogue.mjs [出力先.md]
// 検算: 1歩に5つの型（聞く・笑い・褒め・気遣い・そっと）が1つずつ・字数・英語に日本語なし・どの本音にも持ち物2つ以上としぐさ2つ以上
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
const ROOT = new URL('..', import.meta.url).pathname
const ctx = { window: {} }; vm.createContext(ctx)
vm.runInContext(readFileSync(ROOT + 'talk.js', 'utf8'), ctx)
vm.runInContext(readFileSync(ROOT + 'data.js', 'utf8'), ctx)
const T = ctx.window.HT, D = ctx.window.HD
const NAME = { l: '聞いてほしい', j: '笑わせてほしい', p: '褒めてほしい', q: '気遣ってほしい', s: 'そっとしてほしい' }
const WHY = { l: '話の続きを聞き出す返事', j: '笑いに変える返事', p: 'その人の良さを言葉にする返事', q: '体や状況を先回りして気遣う返事', s: '言葉を足さずに寄り添う返事（かっこの動作）' }
const errs = []
const LIM = { line: 16, opt: 18, react: 16 }
const len = s => [...s].length
const JP = /[ぁ-んァ-ヶ一-龠]/
function check(where, st) {
  const ts = st.o.map(o => o.st).sort().join('')
  if (ts !== 'jlpqs') errs.push(`${where}: 型が5つそろっていない (${ts})`)
  if (len(st.s.ja) > LIM.line) errs.push(`${where}: 一言が長い ${len(st.s.ja)}字「${st.s.ja}」`)
  if (JP.test(st.s.en)) errs.push(`${where}: 英語に日本語`)
  for (const o of st.o) {
    if (len(o.t.ja) > LIM.opt) errs.push(`${where}: 返事が長い ${len(o.t.ja)}字「${o.t.ja}」`)
    if (len(o.r.ja) > LIM.react) errs.push(`${where}: 反応が長い ${len(o.r.ja)}字「${o.r.ja}」`)
    if (JP.test(o.t.en + o.r.en)) errs.push(`${where}: 英語に日本語「${o.t.en}」`)
  }
}
const out = ['# 一晩だけホスト v3 会話と事件の全文', '', '自動生成（tools/dialogue.mjs が talk.js と data.js から書き出す）。ゲームの中身そのもの。', '',
  '## 推理の仕組み', '',
  '- 客の本音は5つ: ' + Object.entries(NAME).map(([k, v]) => `${v}（${k}）`).join('・') + '。どの客も毎回くじで、その客が持ちうる3つから1つ',
  '- 台詞（一言）は客同士で共通。同じ「はぁ……今日ほんと最悪で」でも、本音で当たる返事が変わる',
  '- 画面の3択 = 本音に合う返事1つ＋ほかの型から2つ。3つとも丁寧さはそろえてあり、口調では当たりが分からない',
  '- 手がかり: 卓の持ち物2つ（本音を指す）＋しぐさの一行（毎回変わる）。持ち物は押すと説明が出る。1つで2つの本音を指す物があり、重ねると1つに絞れる',
  '- 当たり: 書き下ろしの反応＋笑顔＋身を乗り出す（機嫌+14）。外れ: 本音のヒントになる冷めた一言＋不機嫌な顔（機嫌-12）',
  '- 途中で本音が変わる客（ユナ・カエデ）: 5往復目で持ち物が入れ替わり「酔ってきた。目つきが変わった」と出る',
  '- ほうさん: 「ほう」しか言わない。横の内勤が青い帯で通訳する。本音は持ち物と表情で読む', '']
out.push('## 手がかり → 本音', '', '### 卓の持ち物（押すと説明）', '')
for (const [k, v] of Object.entries(T.ITEMS)) out.push(`- ${k}「${v.ja}」→ ${[...v.w].map(w => NAME[w]).join(' か ')}`)
out.push('', '### しぐさの一行', '')
for (const g of T.GEST) out.push(`- 「${g.ja}」→ ${[...g.w].map(w => NAME[w]).join(' か ')}`)
out.push('', '### 財布・目印（本音とは別）', '')
for (const [k, v] of Object.entries(T.EXTRA)) out.push(`- ${k}「${v.ja}」`)
for (const w of T.WANTS) {
  const it = Object.keys(T.ITEMS).filter(k => T.ITEMS[k].w.includes(w)), gs = T.GEST.filter(g => g.w.includes(w))
  if (it.length < 2) errs.push(`本音 ${w}: 持ち物が2つ未満`)
  if (gs.length < 2) errs.push(`本音 ${w}: しぐさが2つ未満`)
}
for (const k of [...Object.values(T.ITEMS), ...T.GEST, ...Object.values(T.EXTRA)]) if (len(k.ja) > 22) errs.push(`手がかりが長い ${len(k.ja)}字「${k.ja}」`)
out.push('', '### 本音ごとに、なぜその返事が当たるか', '')
for (const w of T.WANTS) out.push(`- ${NAME[w]}: ${WHY[w]}が当たり。外すと「${T.COLD[w].map(c => c.ja).join('」「')}」のどれか（本音のヒント）`)
out.push('', '## 客', '')
for (const g of T.GUESTS) {
  out.push(`- ${g.name.ja}${g.hon.ja}（${g.k}）: 本音のくじ ${g.wants.map(w => NAME[w]).join('・')}／財布 ${g.wallets.join('・')}` + (g.turn ? '／5往復目で本音が変わる' : '') + (g.speech === 'hoh' ? '／「ほう」だけ、内勤が通訳' : '') + (g.extra ? `／目印 ${g.extra}` : ''))
  for (const w of g.wants) {
    const items = Object.keys(T.ITEMS).filter(k => T.ITEMS[k].w.includes(w)).slice(0, 2)
    out.push(`  - 本音が${NAME[w]}の回: 卓に「${items.map(k => T.ITEMS[k].ja.split('。')[0]).join('」と「')}」、しぐさ「${T.GEST.find(x => x.w.includes(w)).ja}」など → ${WHY[w]}を選ぶ`)
  }
}
const stepMd = (title, st) => {
  out.push(`**${title}** 客「${st.s.ja}」`)
  for (const o of st.o) out.push(`- ${NAME[o.st]}の客に当たる「${o.t.ja}」→「${o.r.ja}」`)
  out.push('')
}
out.push('', '## 最初の一言（くじで1つ）', '')
T.HELLO.forEach((st, i) => { check('最初' + (i + 1), st); stepMd(`最初の一言${i + 1}`, st) })
out.push(`童顔の人の最初の一言だけ、3択の1つが「${T.ID_OPT.t.ja}」になる。`, '')
out.push('## 話題（2歩ずつ。順番はくじ）', '')
T.TOPICS.forEach((tp, i) => { out.push(`### 話題${i + 1}`, ''); tp.forEach((st, j) => { check(`話題${i + 1}-${j + 1}`, st); stepMd(`${j + 1}歩目`, st) }) })
out.push('## 帰り際（くじで1つ）', '')
T.CLOSE.forEach((st, i) => { check('帰り際' + (i + 1), st); stepMd(`帰り際${i + 1}`, st) })
out.push('## 外した時（本音ごと）', '')
for (const w of T.WANTS) out.push(`- ${NAME[w]}: ${T.COLD[w].map(c => `「${c.ja}」`).join(' ')}`)
out.push(`- 時間切れ（無言）: ${D.LINE.silent.map(c => `「${c.ja}」`).join(' ')}（3回続くと帰る）`)
out.push('', '## 事件（会話の途中に、くじで2〜3回）', '', '制限時間はグラスの泡（2択は読む時間込みで3.4秒以上、連打3.8秒、出た瞬間に押す系は出てから1.8秒）。初めての1回は+1秒。さばくと事件対応手当1万円、しくじる（時間切れ含む）とお詫び1万円が明細から引かれる。', '')
const KIND = { two: '2択', mash: '連打', quick: '出た瞬間に押す' }
for (const [k, E] of Object.entries(D.EVENTS)) {
  out.push(`### ${k}${E.rare ? '（レア）' : ''}: ${KIND[E.kind]}`, '', `- 一言: 「${E.line.ja}」` + (E.img ? `（${E.img} が横から入ってくる）` : ''))
  if (E.cues) for (const c of E.cues) out.push(`- 状況「${c.ja}」→ 正解「${E.opts.find(o => o.k === c.ok).ja}」`)
  else if (E.ok === 'want') out.push(`- 正解は客の本音で変わる: ${Object.entries(E.okWant).map(([w, o]) => `${NAME[w]}なら「${E.opts.find(x => x.k === o).ja}」`).join('、')}、それ以外は「${E.opts.find(x => x.k === E.okElse).ja}」`)
  else if (E.ok) out.push(`- 正解「${E.opts.find(o => o.k === E.ok).ja}」`)
  out.push(`- 選択肢: ${E.opts.map(o => `「${o.ja}」`).join(' ')}` + (E.need ? `（${E.need}回）` : ''))
  out.push(`- さばいた: ${E.win.ja ? `「${E.win.ja}」` : Object.values(E.win).map(v => `「${v.ja}」`).join(' ')}（機嫌+${E.mood[0]}${E.tip ? `・チップ${E.tip}円` : ''}）`)
  out.push(`- しくじった・時間切れ: 「${E.lose.ja}」（機嫌${E.mood[1]}${E.cost ? `・${E.costL.ja}${E.cost}円` : ''}）`, '')
  for (const s of [E.line, ...E.opts, E.lose, ...(E.win.ja ? [E.win] : Object.values(E.win)), ...(E.cues || [])]) { if (JP.test(s.en)) errs.push(`事件 ${k}: 英語に日本語`); if (len(s.ja) > 18) errs.push(`事件 ${k}: 長い ${len(s.ja)}字「${s.ja}」`) }
}
const dest = process.argv[2]
if (dest) writeFileSync(dest, out.join('\n'))
const steps = T.HELLO.length + T.CLOSE.length + T.TOPICS.reduce((a, t) => a + t.length, 0)
console.log(`客 ${T.GUESTS.length}人 / 一歩 ${steps} / 事件 ${Object.keys(D.EVENTS).length} / 誤り ${errs.length}`)
if (errs.length) { console.log(errs.join('\n')); process.exit(1) }
