// 一晩だけホスト: 会話（日英）。処理は game.js
// v3: 推理の芯は「同じ一言でも、客の本音で当たりが変わる」。台詞は客同士で共通、違いは卓の持ち物としぐさにだけ出す
// 本音（want）5つ: l=聞いてほしい j=笑わせてほしい p=褒めてほしい q=気遣ってほしい s=そっとしてほしい
// 1歩 = [客の一言, 返事5つ（型ごとに1つ）]。返事 = '型 返事|英 > 当たった時の反応|英'。画面には本音の返事＋ほか2つの3択が出る
// 3つとも「ありそうな返事」で、口調の丁寧さはそろえる。当たり外れは本音との合い方だけで決まる（tools/dialogue.mjs が型の重複・字数を検算）
window.HT = (() => {
  const P = s => { const i = s.indexOf('|'); return i < 0 ? { ja: s, en: s } : { ja: s.slice(0, i).trim(), en: s.slice(i + 1).trim() } }
  const O = s => { const m = s.match(/^([ljpqsi]) (.+?) > (.+)$/); if (!m) throw new Error('bad option: ' + s); return { st: m[1], t: P(m[2]), r: P(m[3]) } }
  const S = (line, ...opts) => ({ s: P(line), o: opts.map(O) })
  const WANTS = ['l', 'j', 'p', 'q', 's']
  const WANT_NAME = { l: P('聞いてほしい|wants to be heard'), j: P('笑わせてほしい|wants to laugh'), p: P('褒めてほしい|wants a compliment'), q: P('気遣ってほしい|wants to be looked after'), s: P('そっとしてほしい|wants quiet') }

  // ---- 最初の一言（くじで1つ。どの本音の客が言ってもおかしくない言葉だけ）
  const HELLO = [
    S('はぁ……今日ほんと最悪で|Ugh... today was the worst',
      'l 何があったんです？聞かせてください|What happened? Tell me > 聞いてくれる？もうね|You will listen? So...',
      'j 最悪の日は、ここで終わらせましょう|Then the worst day ends here > ふふ、言うじゃん|Ha, smooth line',
      'p 最悪の日でも、その服は最高ですね|Worst day, best outfit though > え、分かる？新品なの|You noticed? It is new',
      'q まず温かいお茶、頼みますね|Warm tea first, I will order > 沁みる……気が利くね|So thoughtful... thanks',
      's （黙ってグラスに注ぐ）|(Quietly fill her glass) > ……うん。ありがと|...Yeah. Thanks'),
    S('この店、初めてなんだよね|First time at this place',
      'l 何がきっかけで来たんです？|What brought you here? > 友達にドタキャンされて|A friend bailed on me',
      'j 僕も今夜が初めてです。仲間ですね|Me too, tonight. We are a team > 新人同士か、笑える|Two rookies. Funny',
      'p 初めてで、その落ち着き。素敵です|First time, and so composed > 慣れてないって！|I am not used to it!',
      'q 席、寒くないです？ひざ掛けどうぞ|Cold? Here is a blanket > あ、ほしかった。助かる|Oh, yes please',
      's （メニューを渡して、少し待つ）|(Hand her the menu, then wait) > ゆっくり選べるの、いい|I like not being rushed'),
    S('なんか今日、疲れちゃって|I am kind of worn out today',
      'l 何に一番疲れました？|What wore you out most? > 人間に。主に上司|People. Mostly my boss',
      'j じゃあ今夜は頭を使わない会です|Then tonight is the no-brain party > それ最高、乗った|Perfect, I am in',
      'p 疲れてても、その髪きれいですね|Tired, but your hair is perfect > 朝15分かけたの|Fifteen minutes this morning',
      'q 先にお水とおしぼり、もらいますね|Water and a towel first > 至れり尽くせりじゃん|Full service, huh',
      's （隣で、静かにうなずく）|(Nod quietly beside her) > ……今は、それでいい|...That is enough for now'),
    S('今日、ちょっと飲みたくて|I just wanted a drink today',
      'l 飲みたくなる何か、ありました？|Something make you want one? > あった。聞いてよ|There was. Listen',
      'j 飲む理由は、あとで一緒に作りましょう|We can invent a reason later > 天才の発想だね|Genius idea',
      'p グラスを持つ手、絵になりますね|Your hand on that glass. Art > 手タレ目指そうかな|Hand model career?',
      'q 軽めのから始めましょう。体に優しく|Let us start light, gently > そういうの、うれしい|I like that care',
      's （グラスを合わせて、何も言わない）|(Clink glasses, say nothing) > ……分かってるね|...You get it'),
  ]

  // ---- 話題（2歩ずつ。順番はくじ）
  const TOPICS = [
    [S('上司に案を横取りされたの|My boss stole my idea',
      'l 会議の場でですか？|Right in the meeting? > そう！みんなの前で|Yes! In front of everyone',
      'j 次は案に名前を太字で書きましょう|Next time, sign it in bold > 太字！ゴシックで！|Bold! Size 72!',
      'p 横取りしたくなるほどの案なんですね|It was good enough to steal > ……そう言われると嬉しい|...That actually helps',
      'q 今日は胃に優しいのを頼みましょう|Something gentle on the stomach? > え、胃のこと分かった？|How did you know?',
      's （黙って乾杯のグラスを寄せる）|(Silently raise a glass) > ……うん、乾杯|...Yeah. Cheers'),
     S('しかも拍手しろって顔でさ|And he wanted applause',
      'l まさか、拍手したんですか？|Wait, did you clap? > した。手が勝手に|I did. My hands moved',
      'j 僕なら指笛まで吹きますね|I would whistle too > 吹くな！笑う|Do not! I am laughing',
      'p そこで拍手できるの、大人ですね|Clapping there? So grown-up > 大人にされたの|I was forced to grow up',
      'q 手、冷えてますよ。温かいおしぼりを|Your hands are cold. Warm towel > あったかい……泣く|So warm... I may cry',
      's （何も言わず、グラスを満たす）|(Refill, say nothing) > ……それでいい。ありがと|...That works. Thanks')],
    [S('休みの日、寝てるだけなの|On days off I just sleep',
      'l 寝る前、何を見てるんです？|What do you watch in bed? > 猫の動画。3時間|Cat videos. Three hours',
      'j 寝るのも才能です。プロですね|Sleeping is a talent. Pro level > プロ？表彰して|Pro? Give me a trophy',
      'p だから肌がきれいなんですね|So that is why your skin glows > 寝た甲斐あった！|Worth the sleep!',
      'q 今夜も無理せず、早めに帰りましょう|No pushing tonight. Home early > 優しい……沁みる|Kind... that hits',
      's （同じペースでグラスを傾ける）|(Sip at her pace) > ……この感じ、落ち着く|...This feels calm'),
     S('起きたら夕方なのよ|I wake up and it is evening',
      'l 夕方からは何をするんです？|And then what? > 二度寝。正直に言うと|Nap again. Honestly',
      'j 一日が短くて、お得ですね|Short day. What a bargain > お得なの？それ|A bargain? Really?',
      'p 夕方に起きて、その完成度ですか|Up at dusk and still flawless? > 30分で作ったの|Made in thirty minutes',
      'q 何か食べるもの、頼みましょうか|Shall I order you some food? > 実はお腹ぺこぺこ|Actually starving',
      's （ふっと笑って、うなずくだけ）|(Smile and just nod) > ……分かってくれる？|...You get it?')],
    [S('親が結婚まだかってうるさくて|My parents nag about marriage',
      'l 毎回、電話で言われるんです？|On every phone call? > 毎週日曜。定時連絡|Every Sunday. Like a report',
      'j 「店で修行中」って返しましょう|Tell them you are in training > 何の修行よ！|Training for what!',
      'p 自慢の娘さんなんでしょうね|They must be proud of you > 自慢……されてるかな|Proud... maybe?',
      'q 今夜は忘れましょう。お水どうぞ|Forget it tonight. Here, water > ……助かる、ほんとに|...Thank you, really',
      's （そっとうなずいて、話を待つ）|(Nod softly and wait) > ……言わなくても分かる？|...You understand?'),
     S('架空の彼氏、もう5年目なの|My fake boyfriend: year five',
      'l 設定、どこまで作ってます？|How detailed is he? > 獣医。左利き。優しい|Vet. Left-handed. Kind',
      'j 5年なら、そろそろ紹介ですね|Five years. Time to meet the parents > 架空なのに！？|He does not exist!',
      'p 5年も設定を守れるの、才能です|Five years in character? Talent > 脚本家になれる？|Could I write drama?',
      'q 疲れますよね。今夜は役を休んで|Tiring. Take a night off the role > ……休んでいいんだ|...I can rest?',
      's （笑わずに、グラスを差し出す）|(No laugh, just offer a glass) > ……誰にも言わないでね|...Tell no one')],
    [S('最近、何も楽しくなくて|Nothing is fun lately',
      'l 最後に笑ったの、いつです？|When did you last laugh? > ……思い出せない|...I cannot remember',
      'j じゃあ今から、僕が楽しい係です|I am now the fun department > 係って。もう笑ってる|Department? Already laughing',
      'p 楽しくなくても、目はきれいですよ|Even so, your eyes still shine > ……そういうの、効く|...That works on me',
      'q 寝れてます？甘い物、頼みましょうか|Sleeping OK? Something sweet? > 実は寝てない。頼む|Not really. Yes please',
      's （盛り上げず、隣に座っている）|(No hype, just sit beside her) > ……それ、楽|...That is easy on me'),
     S('笑ったの、健康診断かも|Last laugh: my checkup',
      'l 健診で何があったんです？|What happened there? > 身長が1cm伸びてた|I grew one centimeter',
      'j 健診で笑えるの、才能ですよ|Laughing at a checkup is a gift > 才能の無駄づかい！|What a waste of talent!',
      'p 結果、きっとオールAですね|Bet you got straight A\'s > なんで分かったの|How did you know?',
      'q 健康第一です。今夜は軽めにしましょう|Health first. Light drinks tonight > ほっとする。ありがと|What a relief. Thanks',
      's （ふっと笑って、何も足さない）|(Smile, add nothing) > ……今、ちょっと笑った|...I smiled a little')],
    [S('猫飼いたいけど、家にいなくて|Want a cat, never home',
      'l 飼うなら、どんな子がいいです？|What kind of cat? > 太ってて無愛想な子|Fat and grumpy',
      'j 僕なら留守番できます。ニャー|I can stay home alone. Meow > 鳴くな！笑う|Do not meow! Ha',
      'p 猫に好かれそうな顔してますもん|You have a face cats love > それ、うれしい|I like that',
      'q 忙しすぎますよ。今夜はゆっくりで|You are too busy. Rest tonight > ……うん、ゆっくりする|...Yeah, I will',
      's （待ち受けの猫を、黙って一緒に見る）|(Look at her cat wallpaper together) > ……かわいいでしょ|...Cute, right?'),
     S('実家の猫、私を忘れてた|Our family cat forgot me',
      'l 何年ぶりに帰ったんです？|How long since you went home? > 2年。ひっかかれた|Two years. It scratched me',
      'j 猫は忘れたふりの名人です|Cats fake it. Masters > ふり！？演技派！|Faking? What an actor!',
      'p 猫も照れたんですよ、きっと|It was just shy around you > ……そうだといいな|...I hope so',
      'q ひっかかれてません？絆創膏ありますよ|Scratched? I have a bandage > ある！見て、ここ|Yes! Look, here',
      's （そうなんですね、と小さくうなずく）|(Nod gently) > ……ちょっと泣きそう|...I might cry a bit')],
    [S('晩ごはん、食べそびれた|I missed dinner',
      'l 今日、そんなに忙しかったんです？|Was today that busy? > 昼もゼリーだけ|Lunch was jelly too',
      'j ここのナッツ、実質フルコースです|These nuts are a full course > フルコース！笑う|Full course! Ha',
      'p 食べなくても、そのつやですか|No dinner and still glowing? > え、照れる|Oh, stop it',
      'q 先に食べる物、頼みますね|Let me order food first > 神。ほんとに神|You are a god. Truly',
      's （黙って、ナッツの皿を寄せる）|(Quietly slide the nuts over) > ……ありがと|...Thanks'),
     S('ポテトなら食べられそう|I could eat fries',
      'l 好きな食べ方、あります？|How do you like them? > ケチャップと塩、半分ずつ|Half ketchup, half salt',
      'j 本気のポテト、揚げてもらいます|I will order the serious fries > 本気のポテト！|Serious fries!',
      'p ポテトを選ぶの、センスいいですね|Fries. Excellent taste > 分かってるじゃん|You get it',
      'q 熱いので、取り分けておきますね|They are hot. I will plate some > 気が利く。助かる|Thoughtful. Thanks',
      's （届くまで、静かに待つ）|(Wait quietly until they come) > ……この沈黙、好き|...I like this silence')],
    [S('既読のまま、返せてないの|I left someone on read',
      'l 誰からなんです？|Who is it from? > 元同僚。重い長文|Old coworker. Long and heavy',
      'j 既読は「読んだよ」の返事です|Read IS a reply. Done > 天才の理論！|Genius theory!',
      'p 返事に悩むの、誠実な証拠ですよ|Worrying shows you are sincere > ……救われる|...That saves me',
      'q 今夜はスマホ、預かりましょうか|Want me to hold your phone tonight? > お願い。見たくない|Please. I do not want it',
      's （スマホの話は、それ以上しない）|(Drop the phone topic) > ……触れないの、助かる|...Thanks for not asking'),
     S('明日の朝、返そうかな|Maybe I will reply tomorrow',
      'l 何て返すか、決めてます？|Decided what to say? > 「了解」だけ。強いでしょ|Just "OK". Strong, right?',
      'j 明日の自分に丸投げですね|Leave it to tomorrow-you > 未来の私、がんばれ！|Good luck, future me!',
      'p 一晩寝かせられるの、大人です|Sleeping on it is mature > 大人って言われた！|Someone called me mature!',
      'q じゃあ今夜は、通知を切りましょう|Then mute it for tonight > それいい。切った|Good idea. Done',
      's （そうしましょう、とだけ言う）|(Just say: sounds good) > ……うん、そうする|...Yeah, I will')],
    [S('最近、鏡を見るのが嫌で|I hate mirrors lately',
      'l 何かきっかけ、あったんです？|Did something set it off? > 同窓会の写真……|A reunion photo...',
      'j 鏡が悪いんです。店の鏡は優しいですよ|Blame the mirror. Ours are kind > 店の鏡、盛れる！|Your mirrors flatter me!',
      'p 今日は目元に、まず目がいきました|Your eyes caught me first tonight > ……目元、頑張ったの|...I worked on my eyes',
      'q 照明、少し落としてもらいますね|Let me dim the lights a bit > あ、それ助かる|Oh, that helps',
      's （鏡の話には触れず、乾杯する）|(Skip it, just toast) > ……その感じ、楽|...That is easy on me'),
     S('同窓会、行かなきゃよかった|Should have skipped the reunion',
      'l 誰に会ったんです？|Who did you see? > 初恋の人。社長になってた|First love. Now a CEO',
      'j 次は僕も呼んでください。盛り上げます|Take me next time. I will liven it up > 新人ホストを？笑う|A rookie host? Ha',
      'p たぶん一番、目立ってましたよ|I bet you stood out most > ……そう？そうかな|...You think so?',
      'q 疲れたでしょう。甘い物、頼みますね|Tiring, right? Something sweet > 甘い物、ほしかった|I wanted sweets',
      's （黙って、グラスを差し出す）|(Silently hand her a glass) > ……ありがと|...Thanks')],
    [S('最近、何にもハマれないの|Cannot get into anything',
      'l 前は、何にハマってました？|What were you into before? > 昔はダンス。聞く？|Dance. Want to hear?',
      'j じゃあ僕の推し活、見学しません？|Come observe my fan life > 推し誰！？聞きたい|Who is it? Tell me!',
      'p ハマらなくても、センスは出てますよ|Your taste still shows > ……どこに出てる？|...Where does it show?',
      'q 休む時期です。今日は甘やかします|A resting season. I will spoil you > 甘やかされたい|I want that',
      's （無理に勧めず、うなずく）|(Do not push, just nod) > ……分かってくれるんだ|...You get it'),
     S('昔はダンスやってたけど|I used to dance',
      'l どんなダンスだったんです？|What kind of dance? > 盆踊り。全国大会|Bon dance. Nationals',
      'j 盆踊りなら、僕も負けませんよ|At bon dance, I never lose > 盆踊り！？勝負する？|Bon dance?! Battle me?',
      'p だから姿勢がきれいなんですね|That explains your posture > 背筋は自慢なの|My spine is my pride',
      'q 脚、疲れてません？クッションどうぞ|Legs tired? Have a cushion > 実は痛かった。ありがと|They hurt. Thank you',
      's （思い出してる顔を、そのまま待つ）|(Let her remember, just wait) > ……懐かしいな|...Brings me back')],
  ]

  // ---- 帰り際（くじで1つ）
  const CLOSE = [
    S('もうこんな時間か|Look at the time',
      'l 最後に、言い残したことあります？|Anything left to tell me? > 楽しかった、って話|That it was fun',
      'j 時計、見なかったことにしましょう|Let us pretend we never saw that > 見なかった！|I saw nothing!',
      'p 帰り道も、その服なら目立ちますね|That outfit will shine outside too > 気をつけて帰るね|I will be careful',
      'q タクシー、先に呼んでおきますね|I called a taxi ahead > え、気が利くじゃん|Oh, how thoughtful',
      's （黙って上着を取ってくる）|(Silently fetch her coat) > ……ありがと。またね|...Thanks. See you'),
    S('そろそろ帰ろうかな|Maybe I should go',
      'l 今夜、どの話が一番でした？|Which story was best tonight? > 全部。また話す|All of it. Again soon',
      'j 帰り道、スキップで帰ってください|Skip all the way home > スキップ！？する|Skip?! I will',
      'p 今夜の姿、覚えておきますね|I will remember tonight\'s look > 忘れないでよ|Do not forget it',
      'q 駅まで、傘をお持ちしますね|I will bring an umbrella to the station > え、雨？ありがと|Rain? Thank you',
      's （ドアまで、黙って見送る）|(See her to the door, quietly) > ……いい夜だった|...It was a good night'),
  ]

  // ---- 外した時の冷めた一言。本音のヒントになる（何を外しても、本音ごとに同じ系統）
  const COLD = {
    l: [P('そうじゃなくて、聞いてよ|No, just listen to me'), P('……話、まだ途中なんだけど|...I was not done talking'), P('ねえ、私の話聞いてた？|Were you even listening?')],
    j: [P('重いって。笑わせてよ|Too heavy. Make me laugh'), P('もっと軽くいこうよ|Lighten up, come on'), P('真面目か！つまんない|So serious! Boring')],
    p: [P('ねえ、今日の私どこ見てる？|Are you even looking at me?'), P('……何か気づかない？|...Notice anything?'), P('今日、気合い入れてきたのに|I dressed up tonight, you know')],
    q: [P('……喉、かわいたな|...I am thirsty'), P('ちょっと寒いんだけど|It is a little cold'), P('気が利かないなあ|Not very attentive, huh')],
    s: [P('今は、そっとしといて|Just let me be for now'), P('……ちょっと、しゃべりすぎ|...You talk too much'), P('静かに飲みたいの|I want to drink quietly')],
  }

  // ---- 手がかり。卓の持ち物（押すと説明）としぐさ。どれも1〜2個の本音を指し、重ねると1つに絞れる
  const ITEMS = {
    papers: { w: 'l', ...P('くしゃくしゃの会議資料。仕事で何かあった|Crumpled meeting notes. Work trouble') },
    phone: { w: 'ls', ...P('伏せたスマホ。話したいか、触れたくないか|Phone face down. Talk, or avoid it') },
    medicine: { w: 'lq', ...P('胃薬。聞いてほしいか、体がつらいか|Stomach pills. Wants to vent, or feels bad') },
    readers: { w: 'q', ...P('老眼鏡。メニューの字が小さくてつらそう|Reading glasses. The menu is too small') },
    book: { w: 's', ...P('文庫本。ひとりの時間が好きな人|A paperback. Likes time alone') },
    earbuds: { w: 's', ...P('片耳だけイヤホン。静かにしたい|One earbud still in. Wants quiet') },
    ticket: { w: 'j', ...P('お笑いライブの半券。笑いたい夜|Comedy show stub. Wants to laugh') },
    nose: { w: 'j', ...P('鼻メガネ。二次会帰りで浮かれてる|Joke glasses. Fresh from a party') },
    fish: { w: 'jp', ...P('変な魚のキーホルダー。笑いか、注目か|Goofy fish charm. Laughs, or attention') },
    mirror: { w: 'p', ...P('手鏡。今日の自分を見てほしい|Hand mirror. Wants to be seen') },
    lipstick: { w: 'p', ...P('新色の口紅。気づいてほしい|New lipstick. Wants you to notice') },
    brooch: { w: 'p', ...P('新品のブローチ。気づいてほしい|New brooch. Wants you to notice') },
  }
  // 卓に置くが本音とは別の物（財布と、変な客の目印）
  const EXTRA = {
    cards: P('カードを4枚並べた。財布は厚い|Four cards out. Deep pockets'),
    coupons: P('クーポンの束。財布は薄い|A wad of coupons. Thin wallet'),
    ledger: P('帳簿。予算はきっちり。うかつな営業は命取り|A ledger. Tight budget. Every word recorded'),
    pass: P('定期入れ。学生か社会人か、まだ分からない|A pass case. Student, or adult?'),
  }
  const GEST = [
    { w: 'l', ...P('何か言いかけて、口を閉じた|Starts to say something, stops') },
    { w: 'l', ...P('こちらの目をじっと見ている|Looks you straight in the eye') },
    { w: 'ls', ...P('長いため息をついた|A long sigh') },
    { w: 'lq', ...P('おなかをそっと押さえた|Presses a hand to her stomach') },
    { w: 'sq', ...P('グラスを両手で包んでいる|Cups the glass in both hands') },
    { w: 's', ...P('天井をぼんやり見ている|Stares at the ceiling') },
    { w: 's', ...P('BGMに耳をすませている|Listening to the music') },
    { w: 'j', ...P('隣の卓の笑い声を目で追った|Glances at a laughing table') },
    { w: 'j', ...P('スマホのお笑い動画を閉じた|Closes a comedy clip on her phone') },
    { w: 'jp', ...P('鼻歌まじりで脚をゆらしている|Humming, swinging a foot') },
    { w: 'p', ...P('髪を何度も直している|Keeps fixing her hair') },
    { w: 'p', ...P('ネイルをこちらに向けた|Turns her nails toward you') },
    { w: 'q', ...P('肩をさすって寒そうだ|Rubs her shoulders, cold') },
    { w: 'q', ...P('メニューを遠ざけて目を細めた|Squints, holding the menu far') },
  ]
  const SWITCH = P('酔ってきた。目つきが変わった|Getting tipsy. Her eyes changed')

  // ---- 客。本音は毎回くじ（wants から1つ）。turn の客は途中で本音が変わる
  const LN = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(P) : P(v)]))
  const GUESTS = [
    { k: 'g1', name: P('ミカ|Mika'), hon: P('姫|'), wants: ['l', 'q', 's'], wallets: ['mid', 'poor'] },
    { k: 'g2', name: P('レイナ|Reina'), hon: P('姫|'), wants: ['p', 'j', 's'], wallets: ['rich'] },
    { k: 'g3', name: P('ユナ|Yuna'), hon: P('姫|'), wants: ['j', 'p', 'l'], wallets: ['poor', 'mid'], turn: true },
    { k: 'g4', name: P('ナオ|Nao'), hon: P('姫|'), wants: ['s', 'q', 'l'], wallets: ['mid', 'rich'] },
    { k: 'g5', name: P('サチ|Sachi'), hon: P('姫|'), wants: ['p', 'l', 'q'], wallets: ['mid', 'rich'] },
    { k: 'g6', name: P('カエデ|Kaede'), hon: P('姫|'), wants: ['q', 'p', 'j'], wallets: ['rich'], turn: true },
    // 帳簿の人: 色恋とツケは1回で営業停止（帳簿が目印）
    { k: 'x_tax', gag: 'tax', extra: 'ledger', name: P('帳簿の人|Ledger Man'), hon: P('殿| sir'), wants: ['q', 'l', 's'], wallets: ['poor'],
      lines: LN({ buy: ['領収書は上様で|Receipt to "Sir," please'], last: '予算の上限です|That is my budget limit', over: '予算超過です|Over budget', early: '根拠のない請求です|An unfounded charge', good: 'ただの経理好きです。また|Just an accountant. Again soon', ok: '精算、完了です|Settled', bad: '記録して帰ります|Recorded. Leaving' }) },
    { k: 'x_oba', gag: 'oba', name: P('おばちゃん|Auntie'), hon: P('師匠| sensei'), wants: ['l', 'j', 'q'], wallets: ['mid'],
      lines: LN({ buy: ['説教代や、開けたる|For the lecture. Open it'], last: '今日はここまでや|That is all for today', over: '財布見てから言い|Look at my purse first', early: 'まだ早い！|Too soon!', good: '親に電話しいや|Call your mother', ok: 'ほな|Bye now', bad: 'もう知らん|I give up on you' }) },
    // ほうさん: 「ほう」しか言わない。横で内勤が通訳する。本音は持ち物と表情で読む
    { k: 'x_oji', gag: 'oji', speech: 'hoh', name: P('ほうさん|Mr. Hoh'), hon: P('殿| sir'), wants: ['q', 'p', 'j'], wallets: ['rich'],
      lines: LN({ buy: ['ほう！|Hoh!'], last: 'ほう。（財布を閉じた）|Hoh. (closes wallet)', over: 'ほう……|Hoh...', early: 'ほう……？|Hoh...?', good: 'また来る。……ほう|I will be back. ...Hoh', ok: 'ほう。|Hoh.', bad: 'ほう……|Hoh...' }) },
    // 童顔の人: 26歳か未成年かは毎回くじ。最初の返事の1つが身分証
    { k: 'x_young', gag: 'young', extra: 'pass', name: P('童顔の人|Baby-face'), hon: P('様|'), wants: ['j', 'p', 's'], wallets: ['mid'],
      lines: LN({ idOK: '26です。若く見えた？|I am 26. I look young?', idNG: '姉の服で来ました……|These are my sister\'s clothes...', good: 'また来ます！|I will come again!', ok: 'じゃあ、また|See you', bad: 'か、帰ります|I-I am going' }) },
    { k: 'x_mom', gag: 'mom', name: P('店長の母|Manager\'s Mom'), hon: P('お母様| ma\'am'), wants: ['p', 'l', 'q'], wallets: ['rich'],
      lines: LN({ buy: ['息子につけといて|Put it on my son\'s tab'], last: 'これ以上は息子が泣くわ|Any more and my son cries', good: 'あの子にご飯食べさせて|Make sure he eats', ok: 'じゃあね|Bye now', bad: 'あの子に言っとくわ|I will tell my son' }) },
  ]
  const ID_OPT = O('i 念のため、身分証いいですか|Mind if I check your ID? > え、あ、はい|Oh, um, sure')
  // ほうさんの「ほう」。言い方だけ変わる
  const HOH = { line: [P('ほう。|Hoh.'), P('ほう……|Hoh...'), P('ほう？|Hoh?'), P('ほほう。|Hoh-hoh.')], hit: P('ほう！！|HOH!!'), cold: P('ほう……。|Hoh...'), tr: P('通訳|Staff') }

  // 誰が来るかのくじの重み。店長の母はたまに
  const WEIGHT = { g1: 1, g2: 1, g3: 1, g4: 1, g5: 1, g6: 1, x_tax: 0.55, x_oba: 0.55, x_oji: 0.55, x_young: 0.55, x_mom: 0.3 }
  return { WANTS, WANT_NAME, HELLO, TOPICS, CLOSE, COLD, ITEMS, EXTRA, GEST, SWITCH, GUESTS, ID_OPT, HOH, WEIGHT }
})()
