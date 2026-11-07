// 一晩だけホスト: 文言・客・読みのデータ（日英）。処理は game.js
window.HD = (() => {
  const t = (ja, en) => ({ ja, en })
  const TAGS = ['praise', 'listen', 'joke', 'quiet']

  // 会話の3択。本物（real）と、誰にでも言える薄い言葉（hollow）を持つ
  // praise=その人の細部を拾う（item ごとの DETAIL が本物）／listen=感情が動く極端な質問／joke=持ちネタ／quiet=様子から先回りする
  const LINES = {
    praise: [t('爪の色、服に合わせました？', 'Nails matched to the outfit?'), t('その耳飾り、選び方が渋い', 'Those earrings are a bold pick')],
    listen: [t('一番ヤバかった上司は？', 'Who was your worst boss ever?'), t('人生で一番怒った日は？', 'Your angriest day ever?'), t('一番ひどい客ってどんな人？', 'Who was your worst customer?'), t('今まで一番笑えない失敗は？', 'Your least funny mistake?'), t('今すぐ一人消せるなら誰？', 'One person to banish, right now?'), t('絶対に許さない一言は？', 'What line will you never forgive?')],
    quiet: [t('（先に水と甘い物を頼む）', '(order water and sweets first)'), t('（静かな奥の席に替える）', '(move her to a quieter seat)'), t('（ひざ掛けを持ってくる）', '(bring a lap blanket)'), t('（氷を足して黙っておく）', '(add ice, say nothing)'), t('（店の音を少し下げてもらう）', '(ask staff to lower the music)'), t('（熱いおしぼりに替える）', '(swap in a hot towel)')],
  }
  // 持ちネタは一晩に4本だけ。別の客には新鮮だが、同じ客に同じ話をすると冷める
  const NETA = [t('親には塾講師と言ってます', 'My mom thinks I tutor math'), t('この髪、3時間かかりました', 'This hair took three hours'), t('源氏名、昨日決めました', 'Picked my host name yesterday'), t('スーツは先輩のお下がりです', 'This suit is a hand-me-down'), t('名刺の裏に時給が書いてます', 'My wage is on the back of my card'), t('靴、左右で別の店です', 'My shoes are from two stores')]
  // 誰にでも言える言葉。何も起きない
  const HOLLOW = {
    praise: [t('かわいいですね', 'You are so pretty'), t('きれいですね', 'You look beautiful')],
    listen: [t('最近どうですか？', 'How have you been?'), t('お仕事は何を？', 'What do you do?')],
    joke: [t('面白い話しましょうか', 'Want to hear something funny?'), t('僕、面白いんですよ', 'I am pretty funny, you know')],
    quiet: [t('何飲みます？何でも言って', 'What do you want? Anything'), t('何でもしますよ', 'I will do anything you say')],
  }
  // 持ち物の細部を拾う褒め言葉。卓に見えている物と対応する
  const DETAIL = {
    mirror: [t('その手鏡、彫りがすごい', 'That mirror has fine carving'), t('鏡の金、よく磨いてますね', 'You keep that mirror polished')],
    lipstick: [t('その赤、顔色に合ってます', 'That red suits your skin'), t('口紅の塗り方、きれいです', 'Such a precise lipstick line')],
    brooch: [t('そのブローチ、今日のために？', 'Did you pick that brooch for today?'), t('石の留め方が細かいですね', 'The setting on that is delicate')],
    medicine: [t('胃薬持参、仕事できる人だ', 'Carrying antacids. A real pro'), t('その準備のよさ、尊敬します', 'I respect that preparation')],
    phone: [t('スマホ伏せるの、礼儀正しい', 'Phone face down. Classy'), t('今は電話より自分優先ですね', 'You put yourself first tonight')],
    papers: [t('その資料、夜まで戦ったんだ', 'You fought those papers till night'), t('付箋の貼り方が几帳面です', 'Your notes are so neat')],
    fish: [t('その魚、目が死んでて最高', 'That fish has perfect dead eyes'), t('その魚を選ぶ人、初めてです', 'Nobody ever picks that fish')],
    nose: [t('鼻メガネ持参は覚悟が違う', 'Bringing nose glasses shows resolve'), t('それ似合う人、初めて見た', 'Nobody ever suits those')],
    ticket: [t('半券取っとくの、いいですね', 'I love that you kept the stub'), t('その舞台を選ぶの、渋いです', 'That is a deep-cut show')],
    book: [t('カバーの折り方がきれいです', 'You fold that cover nicely'), t('読みかけの厚さがいいですね', 'That bookmark is well along')],
    earbuds: [t('イヤホンの色、合わせました？', 'Earbuds matched on purpose?'), t('ケースが全然汚れてない', 'That case is spotless')],
    readers: [t('その眼鏡、顔に合ってます', 'Those glasses suit your face'), t('べっ甲を選ぶの、渋いです', 'Tortoiseshell is a bold choice')],
    ledger: [t('帳簿の字、美しいですね', 'Beautiful ledger handwriting'), t('その鉛筆の削り、完璧です', 'That pencil tip is perfect')],
    purse: [t('その財布、長く使ってますね', 'You have used that purse for years'), t('物持ちのよさが分かります', 'You clearly take care of things')],
  }
  // 深掘り: 前の答えから連想して続ける（話を変えない）
  const DEEP = [t('それで相手どうなりました？', 'So what happened to them?'), t('その時なんて言ったんですか', 'What did you say back?'), t('そこ、もう少し聞きたいです', 'Tell me more about that part'), t('なんでそう思ったんですか', 'What made you feel that way?')]
  // 地雷: 自分の要求だけ言う／相手の努力を軽く扱う
  const MINE = [t('シャンパン入れてくださいよ', 'Come on, buy me champagne'), t('メイク、濃いですね', 'That is a lot of makeup'), t('今月ノルマきついんです', 'My quota is killing me'), t('それ、いくらしました？', 'How much did that cost?'), t('それ、無理してません？', 'Are you overdoing it a bit?')]
  // 挽回: 滑った直後に出る予想外の一手
  const COMEBACK = [t('今の僕、何点でした？', 'Rate that answer out of ten'), t('今の、先輩の台本です', 'That line was my senior\'s script'), t('すみません、やり直します', 'Sorry. Let me do that over')]
  // 態度。言葉でなく、しぐさで今の気持ちを見せる
  const ATT = {
    low: [t('スマホを見始めた', 'She started checking her phone'), t('時計を見た', 'She glanced at the clock')],
    warm: [t('グラスをこちらに向けた', 'She turned her glass your way'), t('椅子に深く座り直した', 'She settled back into the sofa')],
    lean: [t('身を乗り出してきた', 'She is leaning in'), t('自分から話し始めた', 'She started talking by herself')],
    full: [t('目を見て笑っている', 'She meets your eyes and laughs'), t('肩を叩いて笑っている', 'She taps your shoulder, laughing')],
  }

  // 手がかり1: 卓に置いてある持ち物としぐさ。本音を指す。何を欲しがるかは毎晩くじ
  const CLUE = {
    praise: [{ i: 'mirror', ...t('手鏡で前髪を直した', 'Fixing her bangs in a mirror') }, { i: 'lipstick', ...t('口紅を塗り直した', 'Reapplying her lipstick') }, { i: 'brooch', ...t('新品のブローチを触った', 'Touching a brand-new brooch') }],
    listen: [{ i: 'medicine', ...t('胃薬を水で流しこんだ', 'Downing stomach medicine') }, { i: 'phone', ...t('スマホを裏返して置いた', 'Put her phone face down') }, { i: 'papers', ...t('丸めた資料を握っている', 'Gripping crumpled papers') }],
    joke: [{ i: 'fish', ...t('変な魚を揺らしている', 'Dangling a weird fish') }, { i: 'nose', ...t('鼻メガネを持ってきた', 'Brought nose glasses') }, { i: 'ticket', ...t('お笑いの半券を見せた', 'Showing a comedy ticket') }],
    quiet: [{ i: 'book', ...t('文庫本を開いた', 'Opened a paperback') }, { i: 'earbuds', ...t('イヤホンをしまわない', 'Keeping her earbuds out') }, { i: 'readers', ...t('老眼鏡をそっとかけた', 'Put on reading glasses') }],
  }
  // 手がかり2: 2手目から出るしぐさ。飽きられた時に挟む話を指す
  const GESTURE = {
    praise: [{ k: 'g_p1', ...t('鏡越しにこっちを見る', 'Checks you via the mirror') }, { k: 'g_p2', ...t('新しい髪を指で巻いた', 'Twirls her new hair') }, { k: 'g_p3', ...t('服のタグをちらっと見せた', 'Flashes her clothing tag') }],
    listen: [{ k: 'g_l1', ...t('ため息を2回ついた', 'Sighed twice') }, { k: 'g_l2', ...t('着信を切ってまた切った', 'Declined a call, again') }, { k: 'g_l3', ...t('話しかけて途中でやめた', 'Started to speak, stopped') }],
    joke: [{ k: 'g_j1', ...t('隣の卓で肩が揺れた', 'Shoulders shake at the next table') }, { k: 'g_j2', ...t('鼻で小さく笑った', 'A small snort') }, { k: 'g_j3', ...t('ダジャレを言いかけた', 'Almost made a pun') }],
    quiet: [{ k: 'g_q1', ...t('壁をじっと眺めている', 'Staring at the wall') }, { k: 'g_q2', ...t('返事がとても短い', 'Very short replies') }, { k: 'g_q3', ...t('水滴を指でなぞっている', 'Tracing droplets on her glass') }],
  }
  // 手がかり3: 財布。持ち物で分かる。普通の人は何も置かない
  const WALLET = {
    rich: { yen: 500000, i: 'cards', ...t('カードを4枚並べた', 'Laid out four cards') },
    mid: { yen: 150000 },
    poor: { yen: 40000, i: 'coupons', ...t('クーポンの束を数えている', 'Counting her coupons') },
    poor2: { yen: 40000, i: 'purse', ...t('財布がレシートで満杯だ', 'Purse stuffed with receipts') },
  }
  // 最初の一言。建前のことがある。しぐさと食い違ったら、しぐさが本当
  const HELLO = {
    praise: [t('今日の私、どう？', 'How do I look?'), t('髪切ったの分かる？', 'Notice my haircut?'), t('この服、高かったの', 'This dress cost a lot')],
    listen: [t('ちょっと聞いてくれる？', 'Can I vent a little?'), t('今日ほんと最悪で', 'Today was the worst'), t('誰かに言いたくて', 'I just need to tell someone')],
    joke: [t('なんか笑わせてよ', 'Make me laugh'), t('今日は騒ぐよ！', 'Tonight we get loud!'), t('面白い子いる？', 'Anyone funny here?')],
    quiet: [t('話さなくていいよ', 'No need to talk'), t('静かに飲みたいな', 'Just a quiet drink'), t('気にしないで', 'Do not mind me')],
  }
  const REACT = {
    good: {
      praise: [t('ふふ、もっと言って', 'Heh. Say more'), t('見る目あるじゃん', 'You have good eyes'), t('今の録音していい？', 'Can I record that?')],
      listen: [t('分かってくれるんだ', 'You get it'), t('でね、聞いてよ', 'And then, listen'), t('やっと言えた', 'Finally said it')],
      joke: [t('なにそれ、ばかじゃん', 'You absolute fool'), t('お腹いたい', 'My stomach hurts'), t('もう一個やって', 'Do another one')],
      quiet: [t('こういうのでいいの', 'This is all I want'), t('……落ち着く', '...Calming'), t('君、分かってるね', 'You get it')],
    },
    sub: [t('まあ、悪くない', 'Not bad, I guess'), t('へえ、そう来るんだ', 'Oh, that angle'), t('ふーん、いいね', 'Hm, nice')],
    meh: [t('うん、ありがと', 'Yeah, thanks'), t('よく言われる', 'I hear that a lot'), t('へえ', 'Huh')],
    mine: [t('今の、営業でしょ', 'That was a sales pitch'), t('なんで今それ言うの', 'Why say that now?')],
    swap: [t('今、話変えた？', 'Did you just change the topic?')],
    comeback: [t('なにそれ、ずるい', 'Okay, that is sneaky'), t('……0点。笑ったけど', '...Zero. But I laughed')],
    deep: [t('そう！ それでね', 'Yes! And then'), t('そこ聞いてくれるんだ', 'You asked about that part')],
    bad: {
      praise: [t('今そういうのいい', 'Not now with that'), t('お世辞はいらない', 'Spare the flattery')],
      listen: [t('詮索しないで', 'Quit prying'), t('別に何もないけど', 'Nothing happened')],
      joke: [t('今それ？', 'Now? Really?'), t('笑うとこどこ？', 'Where do I laugh?')],
      quiet: [t('え、何か言ってよ', 'Uh, say something'), t('寝てる？', 'Are you asleep?')],
    },
    bored: [t('それ、さっきも聞いた', 'Heard that already'), t('同じのしかないの？', 'Is that all you have?')],
    silence: [t('……起きてる？', '...You awake?'), t('なんか話そ？', 'Say something?')],
    early: [t('楽しくなる前に言う？', 'Before I even had fun?'), t('押し売りみたいだね', 'That felt like a sales pitch')],
    over: [t('今日そこまでは無理', 'Not that much tonight'), t('財布、見えてる？', 'Have you seen my purse?')],
    buy: [t('よし、開けちゃおう', 'Fine, open it'), t('今日は特別ね', 'Tonight is special')],
    leaveGood: [t('また来るね、次も君で', 'Next time, you again'), t('指名していい？', 'Can I request you?')],
    leaveOk: [t('ごちそうさま', 'Thanks for the drink'), t('じゃ、そろそろ', 'Well, time to go')],
    leaveBad: [t('チェンジで', 'Next host, please'), t('帰るね', 'I am leaving')],
  }

  // 毎回出る客（見た目と本音は関係ない）
  const REG = [
    { k: 'g1', name: t('ミカ', 'Mika') }, { k: 'g2', name: t('レイナ', 'Reina') }, { k: 'g3', name: t('ユナ', 'Yuna') },
    { k: 'g4', name: t('ナオ', 'Nao') }, { k: 'g5', name: t('サチ', 'Sachi') }, { k: 'g6', name: t('カエデ', 'Kaede') },
  ]
  // 変な客（毎晩ひとり）
  const GAG = {
    tax: { k: 'x_tax', name: t('帳簿の人', 'Ledger Man'), main: 'quiet', sub: 'listen', wallet: 'poor', item: { i: 'ledger', ...t('無言で帳簿をつけている', 'Silently writing in a ledger') }, title: t('殿', ' sir'),
      hello: t('……お気遣いなく', '...Do not mind me'), bad: t('今の、記録します', 'That goes in the record'), good: t('……結構です', '...Very good'), buy: t('領収書は上様で', 'A receipt, please'), leave: t('ただの経理好きです', 'I just love accounting') },
    oba: { k: 'x_oba', name: t('おばちゃん', 'Auntie'), main: 'listen', sub: 'quiet', wallet: 'mid', item: { i: 'papers', ...t('人生の資料を握っている', 'Holding notes on your life') }, title: t('師匠', ' sensei'),
      hello: t('あんた座りなさい', 'You. Sit down'), bad: t('ふざけとんのか', 'You think this is funny?'), good: t('せやろ？ 聞きなさい', 'Right? Now listen'), buy: t('説教代や、開けたる', 'For the lecture. Open it'), leave: t('親に電話しいや', 'Call your mother') },
    oji: { k: 'x_oji', name: t('ほうさん', 'Mr. Hoh'), wallet: 'rich', hoh: true, title: t('殿', ' sir'), hello: t('ほう。', 'Hoh.'), bad: t('ほう……', 'Hoh...'), good: t('ほほう。', 'Ho-hoh.'), buy: t('ほう！', 'Hoh!'), leave: t('ほう。', 'Hoh.') },
    young: { k: 'x_young', name: t('童顔の人', 'Baby-face'), young: true, title: t('様', ''),
      hello: t('こういう店、初めてで', 'First time here'), idOK: t('26です。若く見えた？', 'I am 26. I look young?'), idNG: t('姉の服で来ました……', 'These are my sister\'s clothes...') },
    mom: { k: 'x_mom', name: t('店長の母', 'Manager\'s Mom'), main: 'listen', sub: 'praise', wallet: 'rich', mom: true, item: { i: 'purse', ...t('息子の写真を出してきた', 'Showing a photo of her son') }, title: t('お母様', ' ma\'am'), rare: true,
      hello: t('うちの子、ちゃんとやってます？', 'Is my boy behaving?'), bad: t('あの子そっくりねえ', 'Just like my son'), good: t('あの子も昔は泣き虫で', 'He was such a crybaby'), buy: t('息子につけといて', 'Put it on my son\'s tab'), leave: t('あの子にご飯食べさせて', 'Make sure he eats') },
  }

  const BOTTLE = [
    { i: 'b1', yen: 30000, need: 45, n: t('シャンパーニュ・ド・ピカピカ', 'Champagne de Pikapika') },
    { i: 'b2', yen: 100000, need: 65, n: t('ロゼ・ド・チカチカ', 'Rose de Chikachika') },
    { i: 'b3', yen: 300000, need: 85, n: t('ゴールド・ド・ギラギラ', 'Or de Giragira') },
  ]
  // シャンパンコール。一気飲みの煽りは書かない。客を全肯定するだけ
  const CALL = {
    open: [t('シャンパン\n入りました！', 'Champagne,\neverybody!')],
    mid: [t('{n}に感謝！', 'Thank you, {n}!'), t('今日も生きてて\nえらい！', 'You survived\ntoday!'), t('確定申告\nばっちり！', 'Your taxes\nare flawless!'), t('お肌つやつや！', 'Your skin is glowing!'), t('歯医者も行けて\nえらい！', 'You went to\nthe dentist!'), t('洗濯物も\n取り込んだ！', 'You brought in\nthe laundry!'), t('上司より\n徳が高い！', 'More virtue\nthan your boss!'), t('家賃、期限内！', 'Rent paid on time!'), t('朝ごはんも食べた！', 'You ate breakfast!'), t('まばたきが上手！', 'Elite blinking!')],
    last: [t('ありがとう\nございました！', 'Thank you\nvery much!')],
    tower: [t('タワーいきます！', 'Tower time!'), t('指名の皆さまに\n感謝！', 'Thanks to\nour regulars!'), t('新人、\nよく働いた！', 'The rookie\ndid it!'), t('今夜は\n全員えらい！', 'Everyone was\ngreat tonight!')],
  }
  const QUIP = [t('髪は盛った分だけ給料だ', 'Hair height is your salary'), t('俺の前世、シャンデリア', 'I was a chandelier once'), t('名刺は裏も名刺だぞ', 'A card is card on both sides'), t('今の俺、3割増しだろ', 'I look 30% better now, right'), t('鏡は親友。親友は鏡', 'Mirror is friend. Friend is mirror')]
  const SENPAI_CARD = { i: 'senpai', ...t('先輩の名刺を置いている', 'Keeps a senior host\'s card') }

  const UI = {
    ja: {
      series: '1日だけ職場体験 #5', title: '一晩だけホスト', sub: '手元を読め。売上を積め', start: '入店する', howto: '遊び方', close: '閉じる', load: 'グラスを磨いています', privacy: 'プライバシーについて',
      how: ['新人ホストとして5卓につき、閉店まで売上を積む', '手元の持ち物としぐさが本音。口は建前のことがある', '誰にでも言う言葉は埋もれる。その人の持ち物を拾う', '答えが来たら話を変えず深掘り。同じ話は冷める', '楽しませる前にボトルを勧めると押し売りで終わる', '身を乗り出したら勧めどき。黒い名刺は先輩の客', '滑っても1回は挽回できる。帰り際が良いと指名。3本でタワー'],
      legal: 'このゲームは風刺です。実在の店や人物とは関係ありません。お酒は20歳になってから。',
      boss: '店長', senpai: '先輩', naikin: '内勤',
      intro: ['体験の新人か。今夜は5卓つけ', '客の手元を見ろ。口は建前だ', 'ボトルは楽しませてからだ'], next: 'つぎへ', skip: 'とばす',
      tut: { clue: '手元の一行が本音だ', bottle: '身を乗り出したら勧めどきだ' },
      bottle: 'ボトルを勧める', menu: 'ドリンクメニュー', back: 'もどる', ura: '先輩の落書き', love: '俺の彼女になってよ', tsuke: '今夜はツケでいいよ',
      loveYen: 1000000, tsukeYen: 1500000, idcheck: '身分証を見せてもらう',
      stopLove: 'それ、店ごと止まります！', stopTsuke: 'うちはツケやめたんです！', stopFine: '始末書', stopOk: 'すみません',
      senpaiMad: '俺の客に何してんの？', senpaiFine: '他のホストの客に手を出すと罰金', senpaiHelp: '助かった。ヘルプ手当な',
      raidLove: '恋愛感情につけ込む営業は営業停止の対象。2025年の法改正です', raidTsuke: 'ツケで客を追い込む店だと通報が入りました', raidMinor: '未成年に酒を出しました', raidTax: 'その帳簿、全部書いてました', raidStamp: '営業停止', toSlip: '給料明細へ',
      minorSent: '内勤が家まで送ります', closing: '閉店です', nomiBack: n => `指名${n}本、また来てくれた`, sales: '売上', table: '卓', noms: '指名', again: 'もう一回', toTitle: 'タイトル', save: '画像を保存', post: 'Xでポスト',
      job: 'ホストクラブ', name: '体験ホスト　様', footer: 'tom3games.github.io/job-host',
      payComm: '売上歩合', payNomi: '指名手当', payBottle: 'シャンパン手当', payHelp: 'ヘルプ手当', payMinor: '見抜き手当', dedFine: '他のホストの客', dedWarn: '始末書', dedRaid: '営業停止の損害', unitN: '本', unitT: '回', unitP: '人', note: (a) => `売上¥${a.toLocaleString()}の20%`,
      ranks: { raid: '営業\n停止', zero: 'クビ', low: '見習い', mid: '合格', top: '今夜\n1番', legend: '伝説' }, rankName: { raid: '営業停止', zero: 'クビ', low: '見習い', mid: '合格', top: '今夜の1番', legend: '伝説の新人' },
      comments: { raid: '明日から店がない。君も私も', zero: '接客した？ 椅子じゃないよな', low: '聞く耳はある。話す口を持て', mid: '永久指名、もらえそうだな', top: '明日も来い。髪は盛らなくていい', legend: '私の席を譲る。冗談だ。半分は', mom: '母が来た？ 請求書が怖い' },
      bottles: n => `シャンパン${n}本`, shareText: (s, b, r) => `一晩だけホストの売上¥${s.toLocaleString()}、シャンパン${b}本、称号は「${r}」。 #1日だけ職場体験 #一晩だけホスト`,
    },
    en: {
      series: 'ONE-DAY JOB #5', title: 'HOST FOR A NIGHT', sub: 'Read the table. Stack the sales', start: 'Clock in', howto: 'How to play', close: 'Close', load: 'Polishing the glasses', privacy: 'Privacy',
      how: ['Work 5 tables as a rookie host and stack sales until closing', 'Objects and gestures tell the truth. Words may not', 'Lines anyone could say get buried. Notice her things', 'Follow up on her answer. Repeated stories go cold', 'Offer a bottle before she has fun and it is just a sales pitch', 'Leaning in means it is time. A black card means a senior host\'s guest', 'One slip can be saved. Leave them happy for a request. 3 earn a tower'],
      legal: 'This game is satire. No relation to real clubs or people. Drink only when of legal age.',
      boss: 'Manager', senpai: 'Senior', naikin: 'Floor staff',
      intro: ['New temp? You get 5 tables', 'Watch their hands. Words are a front', 'Bottles come after the fun'], next: 'Next', skip: 'Skip',
      tut: { clue: 'This line is the real her', bottle: 'She leans in. Time to offer' },
      bottle: 'Offer a bottle', menu: 'DRINK MENU', back: 'Back', ura: 'senior\'s scribbles', love: 'Be my girlfriend', tsuke: 'Pay me later, no worries',
      loveYen: 1000000, tsukeYen: 1500000, idcheck: 'Check her ID',
      stopLove: 'That shuts the whole club down!', stopTsuke: 'We stopped doing tabs here!', stopFine: 'Written apology', stopOk: 'Sorry',
      senpaiMad: 'What are you doing with my guest?', senpaiFine: 'Poaching another host\'s guest means a fine', senpaiHelp: 'Thanks for covering me',
      raidLove: 'Exploiting a guest\'s romantic feelings can shut a club down. 2025 law', raidTsuke: 'Someone reported us for pressuring guests over tabs', raidMinor: 'You served alcohol to a minor', raidTax: 'That ledger wrote it all down', raidStamp: 'SHUT DOWN', toSlip: 'See payslip',
      minorSent: 'Staff will see her home', closing: 'Closing time', nomiBack: n => `${n} regulars came back`, sales: 'SALES', table: 'TABLE', noms: 'REQ', again: 'Again', toTitle: 'Title', save: 'Save image', post: 'Post on X',
      job: 'Host club', name: 'One-night host', footer: 'tom3games.github.io/job-host',
      payComm: 'Commission', payNomi: 'Requests', payBottle: 'Champagne', payHelp: 'Covering', payMinor: 'Sharp eye', dedFine: 'Poaching', dedWarn: 'Apology', dedRaid: 'Shutdown losses', unitN: '', unitT: 'x', unitP: '', note: (a) => `20% of ¥${a.toLocaleString()}`,
      ranks: { raid: 'SHUT\nDOWN', zero: 'FIRED', low: 'ROOKIE', mid: 'PASS', top: 'TOP\nHOST', legend: 'LEGEND' }, rankName: { raid: 'Shut down', zero: 'Fired', low: 'Rookie', mid: 'Pass', top: 'Top host tonight', legend: 'Legendary rookie' },
      comments: { raid: 'No club tomorrow. For either of us', zero: 'You served whom? Are you a chair?', low: 'You can listen. Now learn to talk', mid: 'Someone may request you for life', top: 'Come back tomorrow. Less hair', legend: 'Take my seat. Joking. Half joking', mom: 'My mother came? Fear the bill' },
      bottles: n => `${n} champagne`, shareText: (s, b, r) => `Host for a Night: sales ¥${s.toLocaleString()}, ${b} champagne, rank "${r}". #OneDayJob`,
    },
  }
  return { TAGS, LINES, NETA, HOLLOW, DETAIL, DEEP, MINE, COMEBACK, ATT, CLUE, GESTURE, WALLET, HELLO, REACT, REG, GAG, BOTTLE, CALL, QUIP, SENPAI_CARD, UI }
})()
