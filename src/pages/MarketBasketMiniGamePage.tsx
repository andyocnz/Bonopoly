import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState } from 'react'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Rule = {
  antecedent: string
  consequent: string
  support: number
  confidence: number
  lift: number
  promotable: boolean
}

type Round = {
  storeType: string
  context: string
  maxPicks: number
  transactions: string[][]
  rules: Rule[]
  trap: string
  insight: string
}

type PromoIntensity = 'low' | 'medium' | 'high'
type DiscountTier = 0 | 5 | 10

type RoundEconomics = {
  profit: number
  revenue: number
  units: number
  stockoutPenalty: number
  markdownPenalty: number
  promoCost: number
  intensity: PromoIntensity
  discount: DiscountTier
  ruleLabel: string
}

// ─── Round Pool (10 rounds — 5 picked randomly each session) ─────────────────

const ROUND_POOL: Round[] = [
  {
    storeType: 'Grocery Store',
    context: 'Which product pairs are worth promoting together?',
    maxPicks: 1,
    transactions: [
      ['🍞','🧈','🥛'],['🍞','🧈','🥛'],['🍞','🧈','🥛'],['🍞','🧈','🥛'],['🍞','🧈','🥛'],
      ['🍞','🧈'],['🍞','🧈'],['🍞','🧈'],
      ['🥛','🥚'],['🥛','🥚'],['🥛','🥚'],['🥛','🥚'],
      ['🍺','🥨'],['🍺','🥨'],['🍺','🥨'],
      ['🍞','🥛'],['🍞','🥛'],
      ['🥚','🥛','🧀'],['🥚','🥛','🧀'],['🥚','🥛'],
    ],
    rules: [
      { antecedent: '🍞 Bread', consequent: '🧈 Butter', support: 40, confidence: 80, lift: 2.0, promotable: false },
      { antecedent: '🥛 Milk', consequent: '🥚 Eggs', support: 35, confidence: 41, lift: 1.2, promotable: false },
      { antecedent: '🍺 Beer', consequent: '🥨 Pretzels', support: 15, confidence: 100, lift: 6.7, promotable: true },
    ],
    trap: 'Milk → Eggs had 41% confidence — looks interesting. But milk is in almost every basket, so "milk buyers also buy eggs" is just a coincidence, not a real signal. A promotion here wouldn\'t change behaviour.',
    insight: 'Beer → Pretzels is the standout: when someone buys beer, they\'re 6.7× more likely to grab pretzels than a random shopper. Pretzels almost never appear without beer — so the link is real and a bundle promotion would actually work.',
  },
  {
    storeType: 'Café Chain',
    context: 'Find which add-ons are genuinely driven by the anchor — not just popular on their own.',
    maxPicks: 2,
    transactions: [
      ['☕','🍬'],['☕','🍬'],['☕','🍬'],['☕','🍬'],['☕','🍬'],['☕','🍬'],['☕','🍬'],['☕','🍬'],
      ['☕','🥐'],['☕','🥐'],['☕','🥐'],['☕','🥐'],['☕','🥐'],
      ['🍵','🍯'],['🍵','🍯'],['🍵','🍯'],['🍵','🍯'],
      ['☕','🧁'],['☕','🧁'],
      ['🧋','🥤'],['🧋','🥤'],['☕'],['☕'],['☕'],['🍵'],['🍵'],['🥤'],['🍬'],
    ],
    rules: [
      { antecedent: '☕ Coffee', consequent: '🍬 Sugar', support: 28, confidence: 90, lift: 1.1, promotable: false },
      { antecedent: '☕ Coffee', consequent: '🥐 Croissant', support: 17, confidence: 56, lift: 2.8, promotable: true },
      { antecedent: '🍵 Tea', consequent: '🍯 Honey', support: 14, confidence: 100, lift: 3.3, promotable: true },
      { antecedent: '☕ Coffee', consequent: '🧁 Muffin', support: 7, confidence: 25, lift: 1.0, promotable: false },
    ],
    trap: 'Coffee → Sugar had 90% confidence — very tempting! But sugar sachets are grabbed by almost every customer regardless of what they order. Confidence was high only because coffee is the most common drink, not because coffee causes sugar purchases.',
    insight: 'Tea → Honey is a genuine pair: honey is almost never bought without tea, so placing them together actually increases sales. Coffee → Croissant also works — croissant purchases spike specifically during coffee orders, not at random.',
  },
  {
    storeType: 'Electronics Retailer',
    context: 'Which bundles should feature in "Frequently Bought Together"?',
    maxPicks: 2,
    transactions: [
      ['💻','🖱️'],['💻','🖱️'],['💻','🖱️'],['💻','🖱️'],['💻','🖱️'],['💻','🖱️'],['💻','🖱️'],['💻','🖱️'],
      ['📱','📱 Case'],['📱','📱 Case'],['📱','📱 Case'],['📱','📱 Case'],['📱','📱 Case'],
      ['📱','📱 Case'],['📱','📱 Case'],['📱','📱 Case'],['📱','📱 Case'],['📱','📱 Case'],['📱'],
      ['📺','🔌 HDMI'],['📺','🔌 HDMI'],['📺','🔌 HDMI'],['📺','🔌 HDMI'],['📺','🔌 HDMI'],['📺','🔌 HDMI'],
      ['🖱️','⌨️'],['🖱️','⌨️'],['🖱️','⌨️'],['🖱️','⌨️'],
      ['💻'],['💻'],['📱'],['📱'],['🔌 HDMI'],['🔌 HDMI'],['⌨️'],
    ],
    rules: [
      { antecedent: '💻 Laptop', consequent: '🖱️ Mouse', support: 24, confidence: 80, lift: 1.8, promotable: true },
      { antecedent: '📱 Phone', consequent: '📱 Case', support: 30, confidence: 91, lift: 1.1, promotable: false },
      { antecedent: '📺 TV', consequent: '🔌 HDMI Cable', support: 18, confidence: 100, lift: 3.2, promotable: true },
      { antecedent: '🖱️ Mouse', consequent: '⌨️ Keyboard', support: 12, confidence: 57, lift: 2.5, promotable: true },
      { antecedent: '💻 Laptop', consequent: '📱 Case', support: 5, confidence: 17, lift: 0.5, promotable: false },
    ],
    trap: 'Phone → Phone Case had 91% confidence, the highest of any rule. But nearly everyone buys a phone case at some point — with or without just buying a phone. The case market is already huge, so a "buy phone, get case" promotion isn\'t changing anyone\'s behaviour.',
    insight: 'TV → HDMI Cable is a genuine signal: most people only buy an HDMI cable right after they buy a TV. Without a TV purchase, HDMI sales are rare. A bundle prompt at checkout would genuinely boost sales. Mouse → Keyboard works the same way — desk peripherals are bought together as a set.',
  },
  {
    storeType: 'Pharmacy',
    context: 'Identify genuine health basket pairings for end-cap promotions.',
    maxPicks: 2,
    transactions: [
      ['🤧 Cold Med','🧻 Tissue'],['🤧 Cold Med','🧻 Tissue'],['🤧 Cold Med','🧻 Tissue'],
      ['🤧 Cold Med','🧻 Tissue'],['🤧 Cold Med','🧻 Tissue'],['🤧 Cold Med','🧻 Tissue'],
      ['🤧 Cold Med'],['🤧 Cold Med'],['🧻 Tissue'],['🧻 Tissue'],['🧻 Tissue'],['🧻 Tissue'],
      ['🩹 Bandages','🧴 Antiseptic'],['🩹 Bandages','🧴 Antiseptic'],['🩹 Bandages','🧴 Antiseptic'],['🩹 Bandages','🧴 Antiseptic'],
      ['💊 Vitamins','🥤 Protein'],['💊 Vitamins','🥤 Protein'],['💊 Vitamins','🥤 Protein'],
      ['☀️ Sunscreen','💄 Lip Balm'],['☀️ Sunscreen','💄 Lip Balm'],['☀️ Sunscreen','💄 Lip Balm'],['☀️ Sunscreen','💄 Lip Balm'],['☀️ Sunscreen','💄 Lip Balm'],
      ['🧴 Antiseptic'],['💊 Vitamins'],['☀️ Sunscreen'],['💄 Lip Balm'],['🥤 Protein'],
    ],
    rules: [
      { antecedent: '🤧 Cold Med', consequent: '🧻 Tissue', support: 20, confidence: 75, lift: 1.1, promotable: false },
      { antecedent: '🩹 Bandages', consequent: '🧴 Antiseptic', support: 14, confidence: 100, lift: 3.5, promotable: true },
      { antecedent: '💊 Vitamins', consequent: '🥤 Protein Shake', support: 10, confidence: 75, lift: 2.8, promotable: true },
      { antecedent: '☀️ Sunscreen', consequent: '💄 Lip Balm', support: 17, confidence: 83, lift: 2.4, promotable: true },
    ],
    trap: 'Cold Medicine → Tissue felt logical — sick people grab tissues. But tissues are a pharmacy staple bought by everyone constantly. The association is a coincidence of both being common, not a real buying pattern. Promoting them together wouldn\'t move the needle.',
    insight: 'Bandages → Antiseptic is a first-aid kit pattern: customers shopping for wound care buy both together. Antiseptic is rarely bought on its own, so the link is genuine. Sunscreen → Lip Balm follows the same logic — both are sun protection items bought together intentionally.',
  },
  {
    storeType: 'Lifestyle Store',
    context: 'Final challenge: six rules, two confidence traps. Find the top 2 genuine promotions.',
    maxPicks: 2,
    transactions: [
      ['☕ Coffee','🫖 Mug'],['☕ Coffee','🫖 Mug'],['☕ Coffee','🫖 Mug'],
      ['📓 Notebook','🖊️ Pen'],['📓 Notebook','🖊️ Pen'],['📓 Notebook','🖊️ Pen'],['📓 Notebook','🖊️ Pen'],
      ['📓 Notebook','🖊️ Pen'],['📓 Notebook','🖊️ Pen'],['📓 Notebook','🖊️ Pen'],['📓 Notebook','🖊️ Pen'],['📓 Notebook'],['📓 Notebook'],
      ['🧘 Yoga Mat','🚰 Water Bottle'],['🧘 Yoga Mat','🚰 Water Bottle'],['🧘 Yoga Mat','🚰 Water Bottle'],['🧘 Yoga Mat','🚰 Water Bottle'],
      ['🥤 Protein','🧴 Shaker'],['🥤 Protein','🧴 Shaker'],['🥤 Protein','🧴 Shaker'],
      ['🔋 Charger','🔌 Cable'],['🔋 Charger','🔌 Cable'],['🔋 Charger','🔌 Cable'],['🔋 Charger','🔌 Cable'],['🔋 Charger','🔌 Cable'],['🔋 Charger'],['🔋 Charger'],
      ['🍵 Tea','🍯 Honey'],['🍵 Tea','🍯 Honey'],
      ['☕ Coffee'],['☕ Coffee'],['🫖 Mug'],['🖊️ Pen'],['🖊️ Pen'],['🚰 Water Bottle'],['🧴 Shaker'],['🔌 Cable'],['🔌 Cable'],['🔌 Cable'],
    ],
    rules: [
      { antecedent: '☕ Coffee', consequent: '🫖 Mug', support: 8, confidence: 60, lift: 4.0, promotable: true },
      { antecedent: '📓 Notebook', consequent: '🖊️ Pen', support: 22, confidence: 80, lift: 1.1, promotable: false },
      { antecedent: '🧘 Yoga Mat', consequent: '🚰 Water Bottle', support: 11, confidence: 100, lift: 3.1, promotable: true },
      { antecedent: '🥤 Protein', consequent: '🧴 Shaker', support: 8, confidence: 100, lift: 3.8, promotable: true },
      { antecedent: '🔋 Charger', consequent: '🔌 Cable', support: 14, confidence: 71, lift: 1.2, promotable: false },
      { antecedent: '🍵 Tea', consequent: '🍯 Honey', support: 6, confidence: 100, lift: 3.5, promotable: true },
    ],
    trap: 'Notebook → Pen looks obvious (80% confidence, 22% support — the most common rule). But pens are bought everywhere all the time. The "notebook buyers also buy pens" pattern exists only because both are extremely common — not because one drives the other. Same story for Charger → Cable.',
    insight: 'Coffee → Mug is the strongest signal (4.0×): specialty mugs are a niche item that spike specifically during coffee purchases, rarely bought otherwise. Protein → Shaker is equally clear — someone committing to protein powder almost always needs a shaker bottle to go with it.',
  },
  // ── Rounds 6–10 (extra pool for variety) ──────────────────────────────────
  {
    storeType: 'Pet Store',
    context: 'Which pet supply pairing genuinely drives add-on purchases?',
    maxPicks: 1,
    transactions: [
      ['🐾 Leash','🔔 Collar'],['🐾 Leash','🔔 Collar'],['🐾 Leash','🔔 Collar'],['🐾 Leash','🔔 Collar'],['🐾 Leash','🔔 Collar'],['🐾 Leash','🔔 Collar'],
      ['🐶 Dog Food','🦴 Treats'],['🐶 Dog Food','🦴 Treats'],['🐶 Dog Food','🦴 Treats'],['🐶 Dog Food','🦴 Treats'],
      ['🐶 Dog Food'],['🐶 Dog Food'],['🐶 Dog Food'],
      ['🦴 Treats'],['🦴 Treats'],['🦴 Treats'],['🦴 Treats'],['🦴 Treats'],
      ['🐱 Cat Food','🪣 Cat Litter'],['🐱 Cat Food','🪣 Cat Litter'],['🐱 Cat Food','🪣 Cat Litter'],
      ['🐱 Cat Food'],['🐱 Cat Food'],['🪣 Cat Litter'],['🪣 Cat Litter'],
      ['🐾 Leash'],['🔔 Collar'],
    ],
    rules: [
      { antecedent: '🐶 Dog Food', consequent: '🦴 Treats', support: 14, confidence: 57, lift: 1.2, promotable: false },
      { antecedent: '🐾 Leash', consequent: '🔔 Collar', support: 22, confidence: 86, lift: 4.3, promotable: true },
      { antecedent: '🐱 Cat Food', consequent: '🪣 Cat Litter', support: 11, confidence: 60, lift: 1.1, promotable: false },
    ],
    trap: 'Dog Food → Treats had the most combined baskets (confidence 57%). But treats are bought constantly for training, rewards and snacks — whether or not someone just bought dog food. It\'s two popular items coinciding, not a cause-and-effect.',
    insight: 'Leash → Collar has lift of 4.3×: this is a new-dog-owner pattern. Someone buying a leash is almost certainly getting their first dog and needs a collar too. Collar sales spike specifically because of leash purchases — not by themselves. A bundle display here captures a real moment of need.',
  },
  {
    storeType: 'Bookstore',
    context: 'Which pairings are worth featuring in "Customers Also Bought"?',
    maxPicks: 2,
    transactions: [
      ['📚 Novel','🔖 Bookmark'],['📚 Novel','🔖 Bookmark'],['📚 Novel','🔖 Bookmark'],['📚 Novel','🔖 Bookmark'],['📚 Novel','🔖 Bookmark'],['📚 Novel','🔖 Bookmark'],['📚 Novel','🔖 Bookmark'],
      ['📚 Novel'],['📚 Novel'],['📚 Novel'],
      ['🔖 Bookmark'],['🔖 Bookmark'],['🔖 Bookmark'],['🔖 Bookmark'],
      ['🎁 Gift Box','🃏 Greeting Card'],['🎁 Gift Box','🃏 Greeting Card'],['🎁 Gift Box','🃏 Greeting Card'],['🎁 Gift Box','🃏 Greeting Card'],['🎁 Gift Box','🃏 Greeting Card'],
      ['🎁 Gift Box'],
      ['📖 Study Guide','🖊️ Highlighter'],['📖 Study Guide','🖊️ Highlighter'],['📖 Study Guide','🖊️ Highlighter'],['📖 Study Guide','🖊️ Highlighter'],
      ['🖊️ Highlighter'],['🖊️ Highlighter'],['🖊️ Highlighter'],
    ],
    rules: [
      { antecedent: '📚 Novel', consequent: '🔖 Bookmark', support: 24, confidence: 70, lift: 1.1, promotable: false },
      { antecedent: '🎁 Gift Box', consequent: '🃏 Greeting Card', support: 18, confidence: 83, lift: 4.2, promotable: true },
      { antecedent: '📖 Study Guide', consequent: '🖊️ Highlighter', support: 14, confidence: 100, lift: 3.0, promotable: true },
    ],
    trap: 'Novel → Bookmark had the highest support — the most common pairing in the store. But bookmarks are bought by everyone, whether they\'re buying a novel, a textbook, or nothing special. High support just means both are popular, not that one causes the other.',
    insight: 'Gift Box → Greeting Card is an intentional buying occasion (4.2×): gift-givers almost always need both, and cards are rarely bought without a gift context. Study Guide → Highlighter is the same logic — students buying study guides know they\'ll need to annotate them.',
  },
  {
    storeType: 'Hardware Store',
    context: 'Which product bundles should go on the same end-cap display?',
    maxPicks: 2,
    transactions: [
      ['🔨 Hammer','🔩 Nails'],['🔨 Hammer','🔩 Nails'],['🔨 Hammer','🔩 Nails'],['🔨 Hammer','🔩 Nails'],['🔨 Hammer','🔩 Nails'],['🔨 Hammer','🔩 Nails'],
      ['🔨 Hammer'],['🔨 Hammer'],
      ['🔩 Nails'],['🔩 Nails'],['🔩 Nails'],['🔩 Nails'],
      ['🎨 Paint','🖌️ Brush'],['🎨 Paint','🖌️ Brush'],['🎨 Paint','🖌️ Brush'],['🎨 Paint','🖌️ Brush'],['🎨 Paint','🖌️ Brush'],['🎨 Paint','🖌️ Brush'],['🎨 Paint','🖌️ Brush'],
      ['🎨 Paint'],
      ['🔧 Drill','🪛 Drill Bits'],['🔧 Drill','🪛 Drill Bits'],['🔧 Drill','🪛 Drill Bits'],['🔧 Drill','🪛 Drill Bits'],['🔧 Drill','🪛 Drill Bits'],
      ['🔧 Drill'],
      ['📏 Tape Measure'],['📏 Tape Measure'],['📏 Tape Measure'],
    ],
    rules: [
      { antecedent: '🔨 Hammer', consequent: '🔩 Nails', support: 19, confidence: 75, lift: 1.3, promotable: false },
      { antecedent: '🎨 Paint', consequent: '🖌️ Brush', support: 23, confidence: 88, lift: 3.5, promotable: true },
      { antecedent: '🔧 Drill', consequent: '🪛 Drill Bits', support: 17, confidence: 83, lift: 3.8, promotable: true },
    ],
    trap: 'Hammer → Nails looks like the most obvious pair (75% confidence), but nails are a high-volume commodity sold constantly — builders, contractors, and casual DIYers all buy nails on their own. The pairing appears because both are common hardware staples, not because one drives the other.',
    insight: 'Paint → Brush is a genuine combination (3.5×): a brush is almost useless without paint, so brush sales spike specifically when paint is purchased. Drill → Drill Bits is even stronger (3.8×) — a new drill is nearly unusable without the right bits, making it an obvious moment-of-purchase bundle.',
  },
  {
    storeType: 'Sports Store',
    context: 'Which combo deserves a bundle deal promotion this season?',
    maxPicks: 1,
    transactions: [
      ['🎾 Tennis Racket','🎾 Tennis Balls'],['🎾 Tennis Racket','🎾 Tennis Balls'],['🎾 Tennis Racket','🎾 Tennis Balls'],['🎾 Tennis Racket','🎾 Tennis Balls'],['🎾 Tennis Racket','🎾 Tennis Balls'],
      ['🎾 Tennis Balls'],['🎾 Tennis Balls'],['🎾 Tennis Balls'],['🎾 Tennis Balls'],['🎾 Tennis Balls'],['🎾 Tennis Balls'],
      ['👟 Running Shoes','🧦 Sports Socks'],['👟 Running Shoes','🧦 Sports Socks'],['👟 Running Shoes','🧦 Sports Socks'],['👟 Running Shoes','🧦 Sports Socks'],['👟 Running Shoes','🧦 Sports Socks'],
      ['👟 Running Shoes'],['👟 Running Shoes'],
      ['🧦 Sports Socks'],['🧦 Sports Socks'],['🧦 Sports Socks'],['🧦 Sports Socks'],['🧦 Sports Socks'],
      ['💧 Water Bottle'],['💧 Water Bottle'],['💧 Water Bottle'],['💧 Water Bottle'],
      ['🎾 Tennis Racket'],
    ],
    rules: [
      { antecedent: '🎾 Tennis Racket', consequent: '🎾 Tennis Balls', support: 18, confidence: 83, lift: 5.0, promotable: true },
      { antecedent: '👟 Running Shoes', consequent: '🧦 Sports Socks', support: 18, confidence: 71, lift: 1.3, promotable: false },
    ],
    trap: 'Running Shoes → Sports Socks seems natural (you need socks to wear shoes), but sports socks are sold in huge quantities independently — every gym visit, every casual player. They\'re a staple, so the pairing exists only because both are popular, not because shoes drive sock purchases.',
    insight: 'Tennis Racket → Tennis Balls has lift of 5.0×: tennis balls are bought almost exclusively by people who just got a racket or are already playing. Without a racket purchase, ball sales are rare. A bundle at point-of-sale directly captures a real need at exactly the right moment.',
  },
  {
    storeType: 'Specialty Coffee Shop',
    context: 'Redesigning the display counter. Which pairings genuinely drive add-on sales?',
    maxPicks: 2,
    transactions: [
      ['☕ Espresso','🫖 Travel Mug'],['☕ Espresso','🫖 Travel Mug'],['☕ Espresso','🫖 Travel Mug'],['☕ Espresso','🫖 Travel Mug'],
      ['☕ Espresso'],['☕ Espresso'],['☕ Espresso'],['☕ Espresso'],['☕ Espresso'],['☕ Espresso'],['☕ Espresso'],
      ['🫖 Travel Mug'],['🫖 Travel Mug'],
      ['🍰 Cake Slice','🍴 Dessert Fork'],['🍰 Cake Slice','🍴 Dessert Fork'],['🍰 Cake Slice','🍴 Dessert Fork'],['🍰 Cake Slice','🍴 Dessert Fork'],['🍰 Cake Slice','🍴 Dessert Fork'],['🍰 Cake Slice','🍴 Dessert Fork'],
      ['🍰 Cake Slice'],
      ['🌰 Coffee Beans','⚙️ Grinder'],['🌰 Coffee Beans','⚙️ Grinder'],['🌰 Coffee Beans','⚙️ Grinder'],
      ['🌰 Coffee Beans'],
      ['⚙️ Grinder'],['🍴 Dessert Fork'],
    ],
    rules: [
      { antecedent: '☕ Espresso', consequent: '🍰 Cake Slice', support: 0, confidence: 20, lift: 1.0, promotable: false },
      { antecedent: '🍰 Cake Slice', consequent: '🍴 Dessert Fork', support: 21, confidence: 86, lift: 4.0, promotable: true },
      { antecedent: '🌰 Coffee Beans', consequent: '⚙️ Grinder', support: 10, confidence: 75, lift: 3.5, promotable: true },
      { antecedent: '☕ Espresso', consequent: '🫖 Travel Mug', support: 14, confidence: 36, lift: 1.8, promotable: false },
    ],
    trap: 'Espresso → Cake Slice seems logical — coffee and cake go together. But cake is a popular impulse buy regardless of what drink someone orders, and espresso is the most common order. The association exists because espresso appears in most baskets, not because it specifically drives cake sales.',
    insight: 'Cake Slice → Dessert Fork (4.0×): forks are only needed when ordering a cake slice, and they\'re almost never purchased independently. Coffee Beans → Grinder is even more obvious — someone buying specialty beans to brew at home almost always needs a grinder, making this a clear first-purchase bundle.',
  },
]

function pickRounds(): Round[] {
  return [...ROUND_POOL].sort(() => Math.random() - 0.5).slice(0, 5)
}

// ─── Item name lookup ─────────────────────────────────────────────────────────

const EMOJI_NAMES: Record<string, string> = {
  '🍞': 'Bread', '🧈': 'Butter', '🥛': 'Milk', '🥚': 'Eggs',
  '🍺': 'Beer', '🥨': 'Pretzels', '🧀': 'Cheese',
  '☕': 'Coffee', '🍬': 'Sugar', '🥐': 'Croissant',
  '🍵': 'Tea', '🍯': 'Honey', '🧁': 'Muffin', '🧋': 'Bubble Tea', '🥤': 'Drink',
  '💻': 'Laptop', '🖱️': 'Mouse', '📱': 'Phone', '📺': 'TV', '⌨️': 'Keyboard',
}

function itemLabel(raw: string): string {
  return EMOJI_NAMES[raw] ? `${raw} ${EMOJI_NAMES[raw]}` : raw
}

/** Collapse identical baskets into sorted unique rows with a count */
function groupTransactions(txs: string[][]): { items: string[]; count: number }[] {
  const map = new Map<string, number>()
  for (const tx of txs) {
    const key = [...tx].sort().join('|')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ items: key.split('|'), count }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function liftColor(lift: number) {
  if (lift >= 3) return '#16a34a'
  if (lift >= 2) return '#65a30d'
  if (lift >= 1.5) return '#ca8a04'
  return '#dc2626'
}

function liftLabel(lift: number) {
  if (lift >= 3) return 'Excellent'
  if (lift >= 2) return 'Good'
  if (lift >= 1.5) return 'Moderate'
  return 'Weak'
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--mg-muted)' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--mg-text)' }}>{value}%</span>
      </div>
      <div style={{ background: 'var(--mg-border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketBasketMiniGamePage() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const GAME_SLUG = 'market-basket'
  const roomFromUrl = (query.get('room') || '').trim().toUpperCase()
  const inviteToken = (query.get('invite') || '').trim()
  const hasStudentContext = Boolean(roomFromUrl || inviteToken)

  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'done'>(hasStudentContext ? 'playing' : 'setup')
  const [authChecked, setAuthChecked] = useState(hasStudentContext)
  const [canAccessSetup, setCanAccessSetup] = useState(hasStudentContext)
  const [studentAccessResolved, setStudentAccessResolved] = useState(!hasStudentContext)
  const [studentAccessAllowed, setStudentAccessAllowed] = useState(!hasStudentContext)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdLink, setCreatedLink] = useState<{ roomCode: string; joinLink: string } | null>(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)

  const [rounds, setRounds] = useState<Round[]>(() => pickRounds())
  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'reveal'>('playing')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [promoIntensity, setPromoIntensity] = useState<PromoIntensity>('medium')
  const [discountTier, setDiscountTier] = useState<DiscountTier>(0)
  const [inventory, setInventory] = useState(120)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [roundEconomics, setRoundEconomics] = useState<RoundEconomics[]>([])
  const [showHint, setShowHint] = useState(true)

  const round = rounds[roundIndex]
  const selectedIndex = [...selected][0] ?? null

  useEffect(() => {
    if (hasStudentContext) return
    let cancelled = false
    getEducatorSessionCached(true).then(s => {
      if (!cancelled) { setCanAccessSetup(s.ok); setAuthChecked(true) }
    })
    return () => { cancelled = true }
  }, [hasStudentContext])

  useEffect(() => {
    if (!hasStudentContext && authChecked && !canAccessSetup) {
      window.location.href = '/educator-login'
    }
  }, [hasStudentContext, authChecked, canAccessSetup])

  useEffect(() => {
    if (!hasStudentContext) {
      setStudentAccessAllowed(true)
      setStudentAccessResolved(true)
      return
    }
    let cancelled = false
    const validateStudentContext = async () => {
      try {
        let roomCode = roomFromUrl
        if (inviteToken) {
          const inviteResponse = await fetch(`/api/minigames/invite/${encodeURIComponent(inviteToken)}`, {
            headers: { 'Content-Type': 'application/json' },
          })
          if (!inviteResponse.ok) throw new Error('Invalid invite')
          const inviteData = await inviteResponse.json() as {
            success?: boolean
            invite?: { gameType?: string; roomCode?: string | null }
          }
          if (!inviteData.success || inviteData.invite?.gameType !== GAME_SLUG) {
            throw new Error('Invalid invite')
          }
          if (!roomCode) {
            roomCode = String(inviteData.invite?.roomCode || '').trim().toUpperCase()
          }
        }
        if (!roomCode) throw new Error('Missing room code')

        const roomResponse = await fetch(`/api/minigames/join/${encodeURIComponent(roomCode)}`, {
          headers: { 'Content-Type': 'application/json' },
        })
        if (!roomResponse.ok) throw new Error('Invalid room code')
        const roomData = await roomResponse.json() as {
          success?: boolean
          room?: { gameType?: string }
        }
        if (!roomData.success || roomData.room?.gameType !== GAME_SLUG) {
          throw new Error('Invalid room code')
        }
        if (!cancelled) {
          setStudentAccessAllowed(true)
          setStudentAccessResolved(true)
        }
      } catch {
        if (!cancelled) {
          setStudentAccessAllowed(false)
          setStudentAccessResolved(true)
          window.location.href = '/educator-login'
        }
      }
    }
    void validateStudentContext()
    return () => { cancelled = true }
  }, [hasStudentContext, inviteToken, roomFromUrl, GAME_SLUG])

  useEffect(() => {
    if (hasStudentContext && gamePhase === 'setup') {
      setGamePhase('playing')
    }
  }, [hasStudentContext, gamePhase])

  async function handleCreateLink() {
    setCreating(true); setCreateError('')
    try {
      const res = await educatorMiniGamesApi.createSession({ gameType: 'market-basket', teamCount: 1 })
      const roomCode = res.session.roomCode || ''
      const joinLink = roomCode
        ? `${window.location.origin}/mini-games/market-basket?room=${encodeURIComponent(roomCode)}`
        : (res.session.joinByCodeLink || `${window.location.origin}/mini-games/join`)
      setCreatedLink({ roomCode: res.session.roomCode || '', joinLink })
      setSessionsRefreshKey(k => k + 1)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create link')
    } finally { setCreating(false) }
  }

  if (hasStudentContext && !studentAccessResolved) {
    return (
      <MiniGameShell title="Market Basket Analysis" subtitle="Association Rules & Lift" publicMode>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
            Validating classroom access...
          </div>
        </div>
      </MiniGameShell>
    )
  }
  if (hasStudentContext && !studentAccessAllowed) return null

  function toggleRule(i: number) {
    if (phase !== 'playing') return
    setSelected(prev => {
      if (prev.has(i)) return new Set<number>()
      return new Set<number>([i])
    })
  }

  function promoMultiplier(v: PromoIntensity) {
    if (v === 'high') return 1.28
    if (v === 'medium') return 1.15
    return 1.05
  }

  function promoSpend(v: PromoIntensity) {
    if (v === 'high') return 420
    if (v === 'medium') return 220
    return 100
  }

  function roundShock(seed: number) {
    const rng = Math.abs(Math.sin(seed * 12.9898 + 78.233))
    return 0.9 + (rng % 0.2)
  }

  function handleSubmit() {
    if (selectedIndex === null) return
    const rule = round.rules[selectedIndex]
    const baseDemand = 105 + rule.support * 2.9
    const pairLift = Math.max(1, rule.lift)
    // Diminishing returns: very high lift should not blow up demand linearly.
    const effectiveLift = 1 + Math.sqrt(pairLift - 1)
    const demandBoost = 1 + discountTier * 0.01
    const shock = roundShock((roundIndex + 1) * 97 + selectedIndex * 13)
    const unitsWanted = baseDemand * effectiveLift * promoMultiplier(promoIntensity) * demandBoost * shock
    const inventoryCap = inventory + 180
    const unitsSold = Math.min(unitsWanted, inventoryCap)
    const avgPrice = 15 * (1 - discountTier / 100)
    const avgCost = 8.6
    const revenue = unitsSold * avgPrice
    const cogs = unitsSold * avgCost
    const promoCost = promoSpend(promoIntensity)
    const stockoutPenalty = Math.max(0, unitsWanted - inventoryCap) * 0.32
    const leftover = Math.max(0, inventoryCap - unitsSold)
    const markdownPenalty = leftover * (discountTier > 0 ? 0.4 : 0.28)
    const profit = revenue - cogs - promoCost - stockoutPenalty - markdownPenalty
    const inventoryEnd = Math.min(220, Math.round(Math.max(40, leftover + 40)))

    setTotalProfit(s => s + Math.round(profit))
    setTotalRevenue(s => s + Math.round(revenue))
    setInventory(inventoryEnd)
    setRoundEconomics(prev => [...prev, {
      profit: Math.round(profit),
      revenue: Math.round(revenue),
      units: Math.round(unitsSold),
      stockoutPenalty: Math.round(stockoutPenalty),
      markdownPenalty: Math.round(markdownPenalty),
      promoCost,
      intensity: promoIntensity,
      discount: discountTier,
      ruleLabel: `${rule.antecedent} -> ${rule.consequent}`,
    }])
    setPhase('reveal')
  }

  function handleNext() {
    if (roundIndex + 1 >= rounds.length) { setGamePhase('done') }
    else { setRoundIndex(i => i + 1); setSelected(new Set()); setPromoIntensity('medium'); setDiscountTier(0); setPhase('playing') }
  }

  function handleRestart() {
    setRounds(pickRounds())
    setRoundIndex(0)
    setPhase('playing')
    setSelected(new Set())
    setPromoIntensity('medium')
    setDiscountTier(0)
    setInventory(120)
    setTotalProfit(0)
    setTotalRevenue(0)
    setRoundEconomics([])
  }

  // ── Setup screen ──
  if (gamePhase === 'setup') {
    return (
      <MiniGameShell title="Market Basket Analysis" subtitle="Association Rules & Lift"
        sessionsGameType="market-basket" showSessionsTable={authChecked && canAccessSetup}
        sessionsRefreshKey={sessionsRefreshKey} publicMode={false}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            {/* Goal */}
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🛒</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, marginTop: 0, color: 'var(--mg-text)' }}>Market Basket Analysis</h2>
              <p style={{ fontSize: 14, color: 'var(--mg-muted)', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                Students act as retail analysts choosing one product pair and one promotion plan each round.
                The core lesson: high confidence can mislead, but lift and economics together guide profitable promotions.
              </p>
              <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.8 }}>
                <div>📊 <strong style={{ color: 'var(--mg-text)' }}>5 rounds</strong> across different store types</div>
                <div>🎯 <strong style={{ color: 'var(--mg-text)' }}>Rule cards</strong> show support & confidence — lift is hidden</div>
                <div>💡 <strong style={{ color: 'var(--mg-text)' }}>Round simulation</strong> shows units, costs, and profit impact</div>
                <div>🏆 <strong style={{ color: 'var(--mg-text)' }}>Result</strong> based on cumulative net profit</div>
              </div>
            </div>

            {/* Create link */}
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, marginTop: 0, color: 'var(--mg-text)' }}>Assign to Students</h3>
              <p style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 16, marginTop: 0, lineHeight: 1.5 }}>
                Create a shareable link to send students directly to this game.
              </p>
              <button onClick={() => void handleCreateLink()} disabled={creating}
                style={{ width: '100%', padding: '10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', marginBottom: 10, opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating…' : '+ Create Student Link'}
              </button>
              <button onClick={() => setGamePhase('playing')}
                style={{ width: '100%', padding: '10px', background: 'transparent', color: 'var(--mg-muted)', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                ▶ Test Solo
              </button>
              {createError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{createError}</p>}
              {createdLink && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, border: '1px solid var(--mg-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 6 }}>Student link:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input readOnly value={createdLink.joinLink} style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--mg-border)', background: 'var(--mg-surface)', color: 'var(--mg-text)', minWidth: 0 }} />
                    <button onClick={() => navigator.clipboard.writeText(createdLink.joinLink)}
                      style={{ padding: '6px 10px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Copy
                    </button>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                    <QRCodeSVG value={createdLink.joinLink} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Key concept explainer */}
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Core Concept</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { term: 'Support', formula: 'P(A and B)', desc: 'How often this pair appears together in all transactions.', color: '#3b82f6' },
                { term: 'Confidence', formula: 'P(B | A)', desc: 'How often B appears when A is present. Can be misleading.', color: '#f97316' },
                { term: 'Lift', formula: 'Confidence / P(B)', desc: 'How much more likely B is when A is present vs. baseline. The right metric.', color: '#16a34a' },
              ].map(({ term, formula, desc, color }) => (
                <div key={term} style={{ padding: 14, background: 'var(--mg-surface-2)', borderRadius: 8, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 2 }}>{term}</div>
                  <div style={{ fontSize: 12, color, fontFamily: 'monospace', marginBottom: 6 }}>{formula}</div>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // Done screen
  if (gamePhase === 'done') {
    return (
      <MiniGameShell title="Market Basket Analysis" subtitle="Association Rules & Lift" publicMode={hasStudentContext}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--mg-text)', lineHeight: 1.2 }}>Simulation Complete</div>
            <div style={{ fontSize: 15, color: 'var(--mg-muted)', marginTop: 6 }}>
              Final Net Profit: <strong style={{ color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>${totalProfit.toLocaleString()}</strong>
              {' '} | Revenue: <strong style={{ color: 'var(--mg-text)' }}>${totalRevenue.toLocaleString()}</strong>
            </div>
          </div>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Round Results</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--mg-muted)' }}>
                    <th style={{ padding: '8px 6px' }}>Round</th>
                    <th style={{ padding: '8px 6px' }}>Store</th>
                    <th style={{ padding: '8px 6px' }}>Pair</th>
                    <th style={{ padding: '8px 6px' }}>Promo</th>
                    <th style={{ padding: '8px 6px' }}>Revenue</th>
                    <th style={{ padding: '8px 6px' }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {roundEconomics.map((econ, i) => (
                    <tr key={`${econ.ruleLabel}-${i}`} style={{ borderTop: '1px solid var(--mg-border)' }}>
                      <td style={{ padding: '8px 6px', color: 'var(--mg-text)' }}>Q{i + 1}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--mg-text)' }}>{rounds[i]?.storeType || 'Round'}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--mg-text)' }}>{econ.ruleLabel}</td>
                      <td style={{ padding: '8px 6px', color: 'var(--mg-text)' }}>{econ.intensity}/{econ.discount}%</td>
                      <td style={{ padding: '8px 6px', color: 'var(--mg-text)' }}>${econ.revenue.toLocaleString()}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 700, color: econ.profit >= 0 ? '#16a34a' : '#dc2626' }}>${econ.profit.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ background: 'var(--mg-surface)', border: `1px solid var(--mg-border)`, borderLeft: '4px solid var(--mg-accent)', borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13, lineHeight: 1.7, color: 'var(--mg-muted)' }}>
            <strong style={{ color: 'var(--mg-text)' }}>Key rule: </strong>
            Confidence tells you how often B appears when A is present. Lift tells you whether A <em>actually drives</em> extra purchases above baseline. Use both lift and economics to optimize profit.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleRestart} style={{ flex: 1, padding: '12px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Play Again</button>
            {!hasStudentContext && (
              <button onClick={() => setGamePhase('setup')} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--mg-muted)' }}>Back to Setup</button>
            )}
          </div>
        </div>
      </MiniGameShell>
    )
  }

  return (
    <MiniGameShell title="Market Basket Analysis" subtitle="Association Rules & Lift" publicMode={hasStudentContext}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: hasStudentContext ? '32px 20px 24px' : '24px 20px' }}>
        {hasStudentContext && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--mg-text)', lineHeight: 1.1 }}>Market Basket Analysis</div>
            <div style={{ fontSize: 13, color: 'var(--mg-muted)', marginTop: 4 }}>Association Rules and Lift</div>
            <div style={{ fontSize: 13, color: 'var(--mg-text)', marginTop: 8, lineHeight: 1.5 }}>
              Instruction: choose one rule and promotion settings, click <strong>Simulate Round</strong>, then continue.
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap', paddingTop: hasStudentContext ? 4 : 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-muted)' }}>Round {roundIndex + 1} of {rounds.length}</span>
          <span style={{ padding: '3px 10px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20, fontSize: 12, color: 'var(--mg-accent)', fontWeight: 600 }}>{round.storeType}</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>Net Profit: ${totalProfit.toLocaleString()}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-muted)' }}>Revenue: ${totalRevenue.toLocaleString()}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mg-muted)' }}>Inventory: {inventory}</span>
          {!hasStudentContext && (
            <button onClick={() => setGamePhase('setup')}
              style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer' }}>
              ← Leave
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--mg-border)', borderRadius: 4, height: 4, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ width: `${((roundIndex + 1) / rounds.length) * 100}%`, background: 'var(--mg-accent)', height: '100%', transition: 'width 0.4s' }} />
        </div>

        {/* Task banner — full width */}
        <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: '4px solid var(--mg-accent)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14, color: 'var(--mg-text)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>Task: </span>{round.context}
          {phase === 'playing' && <span style={{ color: 'var(--mg-muted)' }}> — Pick one pair, set promo intensity and discount, then simulate this week.</span>}
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>

          {/* ── Left column: data reference panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Customer baskets */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Customer Baskets — {round.transactions.length} transactions
              </div>
              <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 8, padding: '6px 12px' }}>
                {groupTransactions(round.transactions).map(({ items, count }, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--mg-border)' : 'none' }}>
                    <span style={{ fontSize: 13, color: 'var(--mg-text)', lineHeight: 1.4 }}>
                      {items.map(itemLabel).join(' + ')}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mg-muted)', marginLeft: 10, whiteSpace: 'nowrap' }}>
                      ×{count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chain-of-thought guide — always visible in left column */}
            {phase === 'playing' && (
              <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8 }}>
                <button
                  onClick={() => setShowHint(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    💡 How to analyse
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>{showHint ? '▲' : '▼'}</span>
                </button>
                {showHint && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      {
                        n: '1',
                        label: 'Spot popular solo items',
                        hint: 'Which items appear on their own in many rows? Items bought constantly by everyone inflate confidence scores.',
                      },
                      {
                        n: '2',
                        label: 'Check the → side of each rule',
                        hint: 'Is that item independently popular? If so, high Confidence is just reflecting its baseline popularity — not a real link.',
                      },
                      {
                        n: '3',
                        label: 'Look for niche consequents',
                        hint: 'The best rules are where the → item is rare on its own but spikes when the ← item is present. That\'s a real association worth promoting.',
                      },
                    ].map(({ n, label, hint }) => (
                      <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'var(--mg-accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mg-text)', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 12, color: 'var(--mg-muted)', lineHeight: 1.5 }}>{hint}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reveal explanations — shown in left column after submit */}
            {phase === 'reveal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--mg-surface)', border: '1px solid rgba(220,38,38,0.25)', borderLeft: '4px solid #dc2626', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>⚠️ Why confidence can mislead</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--mg-text)' }}>{round.trap}</div>
                </div>
                <div style={{ background: 'var(--mg-surface)', border: '1px solid rgba(22,163,74,0.25)', borderLeft: '4px solid #16a34a', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>✅ What lift revealed</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--mg-text)' }}>{round.insight}</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: rule cards + actions ── */}
          <div>
            {phase === 'playing' && (
              <div style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 4, padding: '2px 8px', color: '#ca8a04', fontSize: 12, fontWeight: 700 }}>Lift is hidden</span>
                Use the data on the left to judge the rules below.
              </div>
            )}

            {/* Rule Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {round.rules.map((rule, i) => {
                const isSelected = selected.has(i)
                const atLimit = selected.size >= 1 && !isSelected
                const revealed = phase === 'reveal'
                let borderColor = 'var(--mg-border)'
                if (isSelected) borderColor = 'var(--mg-accent)'

                return (
                  <div key={i} style={{ background: 'var(--mg-surface)', borderRadius: 10, padding: 14, border: `1.5px solid ${borderColor}`, transition: 'border-color 0.3s', opacity: atLimit ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--mg-text)' }}>
                          {rule.antecedent} → {rule.consequent}
                        </div>
                        <MetricBar label="Support" value={rule.support} color="#3b82f6" />
                        <MetricBar label="Confidence" value={rule.confidence} color="#f97316" />
                        {revealed ? (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--mg-muted)' }}>
                              <span>Lift</span>
                              <span style={{ fontWeight: 700, color: liftColor(rule.lift) }}>{rule.lift.toFixed(1)}× — {liftLabel(rule.lift)}</span>
                            </div>
                            <div style={{ background: 'var(--mg-border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, (rule.lift / 7) * 100)}%`, background: liftColor(rule.lift), height: '100%', borderRadius: 4 }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--mg-muted)' }}>
                              <span>Lift</span>
                              <span style={{ color: 'var(--mg-muted)', letterSpacing: 4 }}>? ? ?</span>
                            </div>
                            <div style={{ background: 'var(--mg-border)', borderRadius: 4, height: 8, backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 6px, rgba(0,0,0,0.1) 6px, rgba(0,0,0,0.1) 12px)' }} />
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                        {!revealed ? (
                          <button onClick={() => toggleRule(i)} disabled={atLimit} style={{ padding: '8px 14px', borderRadius: 8, border: isSelected ? `2px solid var(--mg-accent)` : '2px solid var(--mg-border)', background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent', color: isSelected ? 'var(--mg-accent)' : 'var(--mg-muted)', fontSize: 13, fontWeight: 700, cursor: atLimit ? 'not-allowed' : 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                            {isSelected ? '✓ Promote' : 'Promote?'}
                          </button>
                        ) : (
                          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--mg-muted)', fontWeight: 700 }}>
                            {isSelected ? 'Selected' : 'Not selected'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {phase === 'playing' && (
              <>
                <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Promotion Settings</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
                      Intensity
                      <select value={promoIntensity} onChange={(e) => setPromoIntensity(e.target.value as PromoIntensity)} style={{ width: '100%', marginTop: 5, borderRadius: 8, border: '1px solid var(--mg-border)', background: 'var(--mg-surface-2)', color: 'var(--mg-text)', padding: '8px 10px', fontSize: 13 }}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
                      Discount
                      <select value={discountTier} onChange={(e) => setDiscountTier(Number(e.target.value) as DiscountTier)} style={{ width: '100%', marginTop: 5, borderRadius: 8, border: '1px solid var(--mg-border)', background: 'var(--mg-surface-2)', color: 'var(--mg-text)', padding: '8px 10px', fontSize: 13 }}>
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={10}>10%</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 8 }}>
                  Select one rule to continue.
                </div>
                <button onClick={handleSubmit} disabled={selected.size === 0} style={{ width: '100%', padding: '13px', background: selected.size > 0 ? 'var(--mg-accent)' : '#e2e8f0', color: selected.size > 0 ? '#fff' : '#475569', border: selected.size > 0 ? 'none' : '1px solid #cbd5e1', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: selected.size > 0 ? 'pointer' : 'not-allowed', transition: 'background 0.2s, color 0.2s, border-color 0.2s' }}>
                  {'Simulate Round ->'}
                </button>
              </>
            )}

            {phase === 'reveal' && (
              <div>
                {roundEconomics.length > 0 && (
                  <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Round Outcome</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, fontSize: 13 }}>
                      <div style={{ color: 'var(--mg-muted)' }}>Units sold: <strong style={{ color: 'var(--mg-text)' }}>{roundEconomics[roundEconomics.length - 1].units}</strong></div>
                      <div style={{ color: 'var(--mg-muted)' }}>Revenue: <strong style={{ color: 'var(--mg-text)' }}>${roundEconomics[roundEconomics.length - 1].revenue.toLocaleString()}</strong></div>
                      <div style={{ color: 'var(--mg-muted)' }}>Promo cost: <strong style={{ color: 'var(--mg-text)' }}>${roundEconomics[roundEconomics.length - 1].promoCost.toLocaleString()}</strong></div>
                      <div style={{ color: 'var(--mg-muted)' }}>Stockout penalty: <strong style={{ color: 'var(--mg-text)' }}>${roundEconomics[roundEconomics.length - 1].stockoutPenalty.toLocaleString()}</strong></div>
                      <div style={{ color: 'var(--mg-muted)' }}>Markdown penalty: <strong style={{ color: 'var(--mg-text)' }}>${roundEconomics[roundEconomics.length - 1].markdownPenalty.toLocaleString()}</strong></div>
                      <div style={{ color: 'var(--mg-muted)' }}>Profit: <strong style={{ color: roundEconomics[roundEconomics.length - 1].profit >= 0 ? '#16a34a' : '#dc2626' }}>${roundEconomics[roundEconomics.length - 1].profit.toLocaleString()}</strong></div>
                    </div>
                  </div>
                )}
                <button onClick={handleNext} style={{ width: '100%', padding: '13px', background: 'var(--mg-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  {roundIndex + 1 < rounds.length ? 'Next Round ->' : 'See Results ->'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </MiniGameShell>
  )
}




