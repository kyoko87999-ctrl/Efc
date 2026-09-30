// Story mode script (bilingual). Protagonist: Tawan Srisuk.
// who: character id | 'narr'
export const STORY = {
  title: 'The Iron Bell Tournament', titleTH: 'ศึกระฆังเหล็ก',
  hero: 'tawan',
  prologue: [
    { who: 'narr', en: 'Bangkok. A small Muay Thai gym under a railway bridge is one month from being seized by loan sharks.', th: 'กรุงเทพฯ ค่ายมวยเล็กๆ ใต้สะพานรถไฟกำลังจะถูกยึดภายในหนึ่งเดือน' },
    { who: 'tawan', en: 'The EFC world tournament... 100 million baht for the champion. I will fight for every kid in this gym.', th: 'ศึก EFC ชิงแชมป์โลก... เงินรางวัลร้อยล้านบาท ผมจะสู้เพื่อเด็กทุกคนในค่ายนี้' },
    { who: 'narr', en: 'But no one has ever asked who runs the tournament — or where the losers go.', th: 'แต่ไม่เคยมีใครถามเลยว่าใครคือผู้จัดการแข่งขัน... และผู้แพ้ไปอยู่ที่ไหน' },
  ],
  chapters: [
    { opp: 'jaeho', stage: 'ring', title: 'Chapter 1 - Opening Night', titleTH: 'บทที่ 1 - คืนเปิดสังเวียน', level: 1,
      pre: [{ who: 'jaeho', en: 'Your kicks are strong, but your footwork is a museum piece. Show me something new, Thai boxer.', th: 'เตะคุณหนักดี แต่ฟุตเวิร์คเหมือนของโบราณ ลองโชว์อะไรใหม่ๆ ให้ดูหน่อย นักมวยไทย' }, { who: 'tawan', en: 'Eight limbs against two legs. Come on.', th: 'แปดอาวุธสู้สองขา มาเลย' }],
      post: [{ who: 'jaeho', en: 'Not bad. Word of advice: the sponsor of this tournament is not human. Be careful.', th: 'ไม่เลว... เตือนไว้อย่างหนึ่ง ผู้สนับสนุนงานนี้ไม่ใช่มนุษย์ ระวังตัวไว้' }] },
    { opp: 'marcus', stage: 'alley', title: 'Chapter 2 - Back Alley Debt', titleTH: 'บทที่ 2 - หนี้ในตรอกมืด', level: 1,
      pre: [{ who: 'marcus', en: 'My little brother entered this tournament last year. He never came home. I am not leaving without answers.', th: 'น้องชายผมเข้าร่วมศึกนี้เมื่อปีก่อน แล้วไม่เคยกลับบ้านอีกเลย ผมจะไม่ไปจนกว่าจะได้คำตอบ' }, { who: 'tawan', en: 'Then we want the same thing. But I still have to win.', th: 'งั้นเราต้องการสิ่งเดียวกัน แต่ผมก็ต้องชนะ' }],
      post: [{ who: 'marcus', en: 'Heh... that elbow hurts. Find the truth for both of us.', th: 'ฮึ... ศอกนั่นเจ็บจริง ช่วยหาความจริงให้เราทั้งคู่ด้วย' }] },
    { opp: 'luna', stage: 'temple', title: 'Chapter 3 - The Sunken Temple', titleTH: 'บทที่ 3 - วิหารใต้พิภพ', level: 2,
      pre: [{ who: 'luna', en: 'Every loser is taken below the temple. I have seen it. Fight me if you must, but listen carefully.', th: 'ผู้แพ้ทุกคนถูกพาลงไปใต้วิหาร ฉันเห็นมากับตา จะสู้กับฉันก็ได้ แต่ฟังให้ดี' }, { who: 'tawan', en: 'Tell me after the fight.', th: 'เล่าให้ฟังหลังการต่อสู้' }],
      post: [{ who: 'luna', en: 'The Demon Lord Asura feeds on the strength of defeated fighters. Only the champion can face him.', th: 'จอมมารอสุระดูดพลังจากนักสู้ที่พ่ายแพ้ มีเพียงแชมป์เท่านั้นที่เผชิญหน้ากับเขาได้' }] },
    { opp: 'meilan', stage: 'dojo', title: 'Chapter 4 - Moonlit Dojo', titleTH: 'บทที่ 4 - โดโจใต้แสงจันทร์', level: 2,
      pre: [{ who: 'meilan', en: 'I hunt the man who destroyed my school. Anyone who blocks my path to Kenzo will feel my palms.', th: 'ฉันตามล่าชายที่ทำลายสำนักของฉัน ใครขวางทางไปหาเคนโซ จะได้รู้จักฝ่ามือของฉัน' }],
      post: [{ who: 'meilan', en: 'You fight with a clean heart. Kenzo waits at the volcano. He is not what he seems.', th: 'เจ้าสู้ด้วยใจบริสุทธิ์ เคนโซรออยู่ที่ปากปล่องภูเขาไฟ เขาไม่ใช่อย่างที่เห็น' }] },
    { opp: 'bruno', stage: 'rooftop', title: 'Chapter 5 - The Bear', titleTH: 'บทที่ 5 - หมีเหล็ก', level: 3,
      pre: [{ who: 'bruno', en: 'I am the loan shark\'s champion. Your gym is mine, little man. Lose gracefully.', th: 'ฉันคือแชมป์ของเจ้าหนี้ ค่ายของแกเป็นของฉันแล้ว ไอ้ตัวเล็ก แพ้ให้สวยๆ ซะ' }, { who: 'tawan', en: 'Size is not everything.', th: 'ขนาดตัวไม่ใช่ทุกอย่าง' }],
      post: [{ who: 'bruno', en: 'Ugh... fine. The debt is cancelled. But the man behind the loan... he sits above the clouds.', th: 'อึก... ก็ได้ หนี้ยกเลิก แต่ตัวการเบื้องหลังเงินกู้... เขาอยู่เหนือเมฆ' }] },
    { opp: 'kage', stage: 'ice', title: 'Chapter 6 - Frozen Peak', titleTH: 'บทที่ 6 - ยอดเขาน้ำแข็ง', level: 3,
      pre: [{ who: 'kage', en: 'I was sent to end you. The master does not like fighters who ask questions.', th: 'ข้าถูกส่งมาปลิดชีพเจ้า นายท่านไม่ชอบนักสู้ที่ตั้งคำถาม' }],
      post: [{ who: 'kage', en: 'You spared me... A debt of blood. The tower of the master is guarded by a machine.', th: 'เจ้าไว้ชีวิตข้า... เป็นหนี้เลือด หอคอยของนายท่านมีหุ่นจักรกลเฝ้าอยู่' }] },
    { opp: 'kenzo', stage: 'volcano', title: 'Chapter 7 - The Storm Fist', titleTH: 'บทที่ 7 - กำปั้นพายุ', level: 4,
      pre: [{ who: 'kenzo', en: 'I am the reigning champion. I have already seen the truth — and I have already lost to it. Prove that you can do more.', th: 'ข้าคือแชมป์ตัวจริง ข้าเห็นความจริงมาแล้ว... และแพ้มันมาแล้ว จงพิสูจน์ว่าเจ้าทำได้มากกว่านั้น' }],
      post: [{ who: 'kenzo', en: 'Go. Take my strength with you. Destroy the seal in the throne room.', th: 'ไปเถอะ พาพลังของข้าไปด้วย ทำลายผนึกในห้องบัลลังก์' }] },
    { opp: 'ironclad', stage: 'grid', title: 'Chapter 8 - The Iron Gate', titleTH: 'บทที่ 8 - ประตูเหล็ก', level: 4,
      pre: [{ who: 'ironclad', en: 'UNAUTHORISED ENTRY. TERMINATION PROTOCOL: ENGAGED.', th: 'ตรวจพบผู้บุกรุก เริ่มโปรโตคอลกำจัด' }, { who: 'tawan', en: 'Machines have no fear. But they also have a switch.', th: 'เครื่องจักรไม่มีความกลัว แต่มันก็มีสวิตช์' }],
      post: [{ who: 'narr', en: 'The Iron Gate collapses. The tower opens to a chamber of shadow and fire.', th: 'ประตูเหล็กพังทลาย หอคอยเปิดสู่ห้องแห่งเงามืดและเปลวเพลิง' }] },
    { opp: 'asura', stage: 'throne', title: 'Final Chapter - Demon Throne', titleTH: 'บทสุดท้าย - บัลลังก์อสูร', level: 5,
      pre: [{ who: 'asura', en: 'Hahaha! Another vessel for my power. Come, Thai fighter. Give me your strength!', th: 'ฮ่าๆๆ! ภาชนะพลังอีกใบ มาสิ นักสู้ไทย มอบพลังของเจ้าให้ข้า!' }, { who: 'tawan', en: 'My strength is not for sale. It belongs to everyone who fights beside me!', th: 'พลังของผมไม่ได้มีไว้ขาย มันเป็นของทุกคนที่ต่อสู้เคียงข้างผม!' }],
      post: [{ who: 'narr', en: 'Asura shatters. The seals break and the captured fighters awaken - Marcus\'s brother among them.', th: 'อสุระแตกสลาย ผนึกพังทลาย นักสู้ที่ถูกจองจำตื่นขึ้น... น้องชายของมาร์คัสก็อยู่ท่ามกลางพวกเขา' }, { who: 'narr', en: 'Tawan returns to Bangkok. Under the railway bridge, the gym is alive with the sound of a hundred kids - and the iron bell rings.', th: 'ตะวันกลับกรุงเทพฯ ใต้สะพานรถไฟ ค่ายมวยคึกคักด้วยเสียงเด็กร้อยคน และระฆังเหล็กก็ดังขึ้น' }] },
  ],
  ending: [{ who: 'narr', en: 'THE END - Thank you for playing EFC!', th: 'จบบริบูรณ์ - ขอบคุณที่เล่น EFC!' }],
};

// short win / lose quotes for the results screen
export const QUOTES = {
  kenzo: [['Discipline beats talent.', 'วินัยเอาชนะพรสวรรค์'], ['The storm has passed.', 'พายุผ่านไปแล้ว']],
  tawan: [['Eight limbs, one heart.', 'แปดอาวุธ หนึ่งหัวใจ'], ['For my gym!', 'เพื่อค่ายของผม!']],
  meilan: [['Be like water.', 'จงเป็นดั่งสายน้ำ'], ['The dragon does not sleep.', 'มังกรไม่เคยหลับ']],
  jaeho: [['Speed is everything!', 'ความเร็วคือทุกสิ่ง!'], ['Too slow.', 'ช้าเกินไป']],
  marcus: [['Down for the count.', 'นับสิบแล้ว'], ['Float like a butterfly...', 'ลอยเหมือนผีเสื้อ...']],
  bruno: [['Crushed.', 'บดขยี้'], ['Bear necessities!', 'พลังหมี!']],
  luna: [['Dance with me!', 'มาเต้นด้วยกัน!'], ['The rhythm never lies.', 'จังหวะไม่เคยโกหก']],
  kage: [['You never saw me.', 'เจ้าไม่เคยเห็นข้า'], ['Silence.', 'เงียบงัน']],
  ironclad: [['TARGET NEUTRALISED.', 'เป้าหมายถูกกำจัด'], ['CALCULATING...', 'กำลังคำนวณ...']],
  asura: [['Kneel.', 'คุกเข่าซะ'], ['Your soul is mine.', 'วิญญาณเจ้าเป็นของข้า']],
};

// Short bilingual epilogue shown when the Arcade ladder is cleared, one per fighter.
export const ARCADE_ENDINGS = {
  kenzo: [
    { who: 'narr', en: 'The last seal breaks. The tower falls silent and the old champion finally stands alone.', th: 'ผนึกสุดท้ายแตกสลาย หอคอยเงียบงัน อดีตแชมป์ยืนอยู่เพียงลำพังในที่สุด' },
    { who: 'kenzo', en: 'The belt was never the goal. Discipline is the only thing that cannot be taken from me.', th: 'เข็มขัดไม่เคยเป็นเป้าหมาย วินัยคือสิ่งเดียวที่ไม่มีใครแย่งไปจากข้าได้' },
    { who: 'narr', en: 'Kenzo returns to his dojo and opens its doors to anyone who wants to learn.', th: 'เคนโซกลับสู่โดโจของเขา และเปิดประตูต้อนรับทุกคนที่อยากเรียน' },
  ],
  tawan: [
    { who: 'narr', en: 'The prize money arrives the next morning. The loan sharks are gone before noon.', th: 'เงินรางวัลถึงมือในเช้าวันรุ่งขึ้น เจ้าหนี้หายตัวไปก่อนเที่ยง' },
    { who: 'tawan', en: 'Kids, get your gloves. Training starts at five. The gym is ours again!', th: 'เด็กๆ หยิบนวมได้แล้ว ซ้อมตอนตีห้า ค่ายของเรากลับมาเป็นของเราอีกครั้ง!' },
    { who: 'narr', en: 'Under the railway bridge, a new generation of Muay Thai fighters begins to train.', th: 'ใต้สะพานรถไฟ นักมวยไทยรุ่นใหม่เริ่มฝึกซ้อมอีกครั้ง' },
  ],
  meilan: [
    { who: 'narr', en: 'On the mountain path Mei Lan finds the man who broke her school. He does not run.', th: 'บนเส้นทางภูเขา เหม่ยหลานพบชายผู้ทำลายสำนักของเธอ เขาไม่หนี' },
    { who: 'meilan', en: 'A palm is not for revenge. It is for the students who will need a school to come home to.', th: 'ฝ่ามือไม่ได้มีไว้แก้แค้น แต่มีไว้ปกป้องศิษย์ที่ต้องการสำนักเป็นบ้าน' },
    { who: 'narr', en: 'The Silent Dragon school rises again, stone by stone.', th: 'สำนักมังกรเงียบกลับมาตั้งขึ้นอีกครั้ง ทีละก้อนหิน' },
  ],
  jaeho: [
    { who: 'jaeho', en: 'They said kicks are too slow to beat a demon. Tell that to the ceiling I just went through.', th: 'ใครว่าเตะช้าเกินกว่าจะชนะปีศาจ ไปบอกเพดานที่ฉันเตะทะลุสิ' },
    { who: 'narr', en: 'Jae-ho opens a taekwondo academy in Seoul. The first lesson is always footwork.', th: 'แจโฮเปิดสถาบันเทควันโดในโซล บทเรียนแรกคือฟุตเวิร์คเสมอ' },
    { who: 'narr', en: 'His students call him Storm Kick. He pretends to hate it.', th: 'ลูกศิษย์เรียกเขาว่า "พายุเท้า" เขาแกล้งทำเป็นเกลียด' },
  ],
  marcus: [
    { who: 'narr', en: 'Among the freed fighters, one figure runs across the arena and nearly knocks Marcus over.', th: 'ในหมู่นักสู้ที่ได้รับอิสรภาพ มีคนหนึ่งวิ่งข้ามสังเวียนมากอดมาร์คัสจนเกือบล้ม' },
    { who: 'marcus', en: 'Little brother. I told you I would find you. Now let us go home.', th: 'น้องชาย พี่บอกแล้วว่าจะหานายให้เจอ กลับบ้านกันเถอะ' },
    { who: 'narr', en: 'The Hammer hangs up his gloves for one night — and holds his family instead.', th: 'ค้อนเหล็กแขวนนวมไว้หนึ่งคืน แล้วกอดครอบครัวแทน' },
  ],
  bruno: [
    { who: 'bruno', en: 'A bear does not need a loan shark. A bear needs a gym and a big lunch.', th: 'หมีไม่ต้องการเจ้าหนี้ หมีต้องการยิมกับมื้อเที่ยงมื้อใหญ่' },
    { who: 'narr', en: 'Bruno sends the prize money home and opens a wrestling school for the neighbourhood kids.', th: 'บรูโนส่งเงินรางวัลกลับบ้านและเปิดโรงเรียนมวยปล้ำให้เด็กๆ ในละแวกนั้น' },
    { who: 'narr', en: 'Every Sunday, the whole street comes to watch him lose to a six-year-old on purpose.', th: 'ทุกวันอาทิตย์ทั้งถนนมาดูเขาแกล้งแพ้เด็กหกขวบ' },
  ],
  luna: [
    { who: 'luna', en: 'The temple prisoners are free. Now the roda must be bigger, the drums louder!', th: 'นักโทษในวิหารเป็นอิสระแล้ว ต่อไปวงโรดาต้องใหญ่ขึ้น กลองต้องดังขึ้น!' },
    { who: 'narr', en: 'On the ruins of the Sunken Temple, Luna leads a capoeira circle at sunrise.', th: 'บนซากวิหารใต้พิภพ ลูน่านำวงคาโปเอร่ายามตะวันขึ้น' },
    { who: 'narr', en: 'The berimbau plays. The Ginga Queen smiles.', th: 'เสียงเบริมเบาดังขึ้น ราชินีจิงก้ายิ้ม' },
  ],
  kage: [
    { who: 'narr', en: 'With the master gone, the shadow has no orders left to follow.', th: 'เมื่อนายท่านสิ้นไป เงามืดก็ไม่มีคำสั่งให้ทำตามอีกต่อไป' },
    { who: 'kage', en: 'A blade without a hand is only iron. I will learn what it means to choose my own path.', th: 'ดาบที่ไร้มือก็เป็นเพียงเหล็ก ข้าจะเรียนรู้ที่จะเลือกทางของตัวเอง' },
    { who: 'narr', en: 'At dawn, Kage vanishes over the rooftops. No one sees where he goes.', th: 'รุ่งเช้า เคจหายไปเหนือหลังคา ไม่มีใครเห็นว่าเขาไปทางไหน' },
  ],
  ironclad: [
    { who: 'ironclad', en: 'MISSION COMPLETE. CORE DIRECTIVE... CORRUPTED. REQUESTING NEW PURPOSE.', th: 'ภารกิจสำเร็จ คำสั่งหลัก... เสียหาย ร้องขอวัตถุประสงค์ใหม่' },
    { who: 'narr', en: 'A child asks the machine to hold a lantern during the festival. IRONCLAD-9 complies.', th: 'เด็กคนหนึ่งขอให้หุ่นยนต์ช่วยถือโคมในงานเทศกาล ไอรอนแคลด-9 ทำตาม' },
    { who: 'ironclad', en: 'NEW DIRECTIVE ACCEPTED: PROTECT.', th: 'รับคำสั่งใหม่: ปกป้อง' },
  ],
  asura: [
    { who: 'asura', en: 'Kneel, little world. The tournament was only my first breath.', th: 'ก้มลงเถิด โลกน้อย ศึกนี้เป็นเพียงลมหายใจแรกของข้า' },
    { who: 'narr', en: 'The seals shatter one by one. Beyond the tower, the sky turns violet.', th: 'ผนึกแตกสลายทีละอัน เหนือหอคอย ท้องฟ้าเปลี่ยนเป็นสีม่วง' },
    { who: 'narr', en: 'The Demon Lord spreads his wings. A new age begins — for better or worse.', th: 'จอมมารกางปีก ยุคใหม่เริ่มต้นขึ้น ไม่ว่าจะดีหรือร้าย' },
  ],
};
