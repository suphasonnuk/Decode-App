// ── Daily Morning Feed ──────────────────────────────────────────────────────
// Curated content across 7 categories, rotated daily by day-of-year.
// Each entry is self-contained: no external API needed.

export type FeedCategory = 'business' | 'health' | 'sports' | 'psychology' | 'motivation' | 'science' | 'tech'
export type FeedType = 'quote' | 'fact' | 'tip' | 'paper' | 'insight'

export interface FeedItem {
  category: FeedCategory
  type: FeedType
  icon: string
  title: string
  body: string
  source: string
  color: string
}

// Category styling
export const FEED_CATEGORY_STYLE: Record<FeedCategory, { icon: string; color: string; label: string }> = {
  business:   { icon: '💼', color: 'oklch(72% 0.14 60)',  label: 'Business'   },
  health:     { icon: '🧬', color: 'oklch(72% 0.18 150)', label: 'Health'     },
  sports:     { icon: '🏃', color: 'oklch(72% 0.16 30)',  label: 'Sports'     },
  psychology: { icon: '🧠', color: 'oklch(74% 0.18 280)', label: 'Psychology' },
  motivation: { icon: '🔥', color: 'oklch(72% 0.18 25)',  label: 'Motivation' },
  science:    { icon: '🔬', color: 'oklch(72% 0.16 200)', label: 'Science'    },
  tech:       { icon: '⚡', color: 'oklch(72% 0.14 250)', label: 'Tech'       },
}

const FEED_ITEMS: FeedItem[] = [
  // ── BUSINESS ───────────────────────────────────────────────────────────────
  { category: 'business', type: 'quote', icon: '💼', title: 'Focus on value, not activity',
    body: '"Efficiency is doing things right; effectiveness is doing the right things." Most people optimize for speed when they should optimize for direction.',
    source: 'Peter Drucker', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'insight', icon: '💼', title: 'The 80/20 of decisions',
    body: 'Jeff Bezos separates decisions into one-way doors (irreversible, need careful analysis) and two-way doors (reversible, decide fast). Most decisions are two-way doors — stop overthinking them.',
    source: 'Bezos shareholder letter, 2016', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'fact', icon: '💼', title: 'Meetings cost more than you think',
    body: 'A 1-hour meeting with 8 people isn\'t 1 hour — it\'s 8 hours of productivity. Shopify calculated their "meeting cost" and eliminated 10,000+ calendar events in one quarter.',
    source: 'Shopify internal memo, 2023', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'tip', icon: '💼', title: 'Write before you meet',
    body: 'Amazon requires 6-page written memos before meetings. Writing forces clarity. If you can\'t write it clearly, you don\'t understand it yet.',
    source: 'Amazon leadership principles', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'insight', icon: '💼', title: 'The compound effect of 1% better',
    body: 'If you get 1% better each day for one year, you\'ll be 37× better. If you get 1% worse each day, you\'ll decline to nearly zero. Small daily improvements compound into remarkable results.',
    source: 'James Clear, Atomic Habits', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'quote', icon: '💼', title: 'Strategy is saying no',
    body: '"People think focus means saying yes to the thing you\'ve got to focus on. But that\'s not what it means at all. It means saying no to the hundred other good ideas."',
    source: 'Steve Jobs, WWDC 1997', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'fact', icon: '💼', title: 'Deep work is rare and valuable',
    body: 'Knowledge workers spend only 2.5 hours per day on productive work. The rest is shallow tasks, email, and context switching. Protecting deep work blocks is your highest-leverage move.',
    source: 'Cal Newport, Deep Work', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'tip', icon: '💼', title: 'The two-minute rule',
    body: 'If a task takes less than two minutes, do it immediately. The overhead of tracking, scheduling, and remembering it costs more than just doing it now.',
    source: 'David Allen, Getting Things Done', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'insight', icon: '💼', title: 'First principles over analogies',
    body: 'Reasoning by analogy means copying what others do. First principles means breaking problems down to fundamental truths and building up from there. Innovation lives in first principles.',
    source: 'Elon Musk', color: 'oklch(72% 0.14 60)' },
  { category: 'business', type: 'quote', icon: '💼', title: 'The power of constraints',
    body: '"Constraints drive innovation. When you have fewer resources, you\'re forced to be more creative." Every successful startup began with extreme constraints that became advantages.',
    source: 'Marissa Mayer', color: 'oklch(72% 0.14 60)' },

  // ── HEALTH (Huberman-style) ────────────────────────────────────────────────
  { category: 'health', type: 'tip', icon: '🧬', title: 'Morning sunlight resets your clock',
    body: 'Get 10 minutes of sunlight within 30 minutes of waking. This triggers a cortisol pulse that sets your circadian clock, improves alertness, and makes you sleep better 14–16 hours later.',
    source: 'Huberman Lab Podcast, Ep. 2', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'paper', icon: '🧬', title: 'Cold exposure boosts dopamine 250%',
    body: 'Deliberate cold exposure (1–3 min cold shower) increases dopamine by 250% for up to 3 hours. Unlike caffeine, it doesn\'t cause a crash. The effect is comparable to some medications.',
    source: 'Šrámek et al., Eur J Appl Physiol, 2000', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'fact', icon: '🧬', title: 'Your gut makes 95% of serotonin',
    body: 'The gut produces 95% of the body\'s serotonin — the "happiness" neurotransmitter. Fiber-rich foods feed gut bacteria that produce serotonin precursors. Your mood literally starts in your gut.',
    source: 'Yano et al., Cell, 2015', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'tip', icon: '🧬', title: 'The NSDR protocol for energy',
    body: 'Non-Sleep Deep Rest (NSDR): Lie down, close eyes, do body scan breathing for 10–20 minutes. Studies show it restores dopamine by 65% and improves focus for the next 2–4 hours.',
    source: 'Huberman Lab Podcast, Ep. 4', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'paper', icon: '🧬', title: 'Exercise beats antidepressants',
    body: '30 minutes of moderate exercise 3× per week was as effective as sertraline (Zoloft) for treating major depression, with lower relapse rates at 10 months.',
    source: 'Blumenthal et al., Psychosomatic Med, 1999', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'fact', icon: '🧬', title: 'Caffeine timing matters',
    body: 'Delay caffeine 90–120 minutes after waking. Adenosine (sleepiness chemical) is naturally cleared by morning cortisol. Coffee too early blocks this process and causes an afternoon crash.',
    source: 'Huberman Lab Podcast, Ep. 101', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'tip', icon: '🧬', title: 'Zone 2 cardio for longevity',
    body: 'Zone 2 training (can hold a conversation, slightly breathless) for 150–200 min/week is the single most impactful exercise for metabolic health and longevity. Walk, bike, or jog at low intensity.',
    source: 'Peter Attia, Outlive', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'paper', icon: '🧬', title: 'Sleep deprivation kills focus',
    body: 'Just one night of 4 hours sleep reduces cognitive performance by 50%. After 5 nights of 6 hours sleep, performance equals being legally drunk. Sleep is non-negotiable for performance.',
    source: 'Van Dongen et al., Sleep, 2003', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'fact', icon: '🧬', title: 'Magnesium deficiency is epidemic',
    body: '50% of adults don\'t get enough magnesium. It\'s critical for 300+ enzyme reactions including sleep, muscle recovery, and stress response. Mg threonate crosses the blood-brain barrier best.',
    source: 'Huberman Lab Podcast, Ep. 31', color: 'oklch(72% 0.18 150)' },
  { category: 'health', type: 'tip', icon: '🧬', title: 'Nasal breathing > mouth breathing',
    body: 'Nasal breathing filters air, produces nitric oxide (vasodilator), and activates the parasympathetic nervous system. Mouth taping during sleep improved sleep quality by 24% in studies.',
    source: 'Nestor, Breath: The New Science', color: 'oklch(72% 0.18 150)' },

  // ── SPORTS ─────────────────────────────────────────────────────────────────
  { category: 'sports', type: 'fact', icon: '🏃', title: 'Consistency beats intensity',
    body: 'People who exercise 4× per week at moderate intensity for 12 months had better results than those who did intense 6× per week but quit at month 3. Adherence is the #1 predictor of results.',
    source: 'Dishman et al., Med Sci Sports Exerc, 2004', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'tip', icon: '🏃', title: 'The minimum effective dose',
    body: 'Just 11 minutes of moderate-to-vigorous physical activity per day is associated with a 23% lower risk of premature death. You don\'t need hours — you need consistency.',
    source: 'Watts et al., Br J Sports Med, 2023', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'fact', icon: '🏃', title: 'Walking is underrated',
    body: '10,000 steps is good but even 4,000 steps/day significantly reduces all-cause mortality. Every additional 1,000 steps decreases mortality risk by 15%. A 20-minute walk counts.',
    source: 'Banach et al., Eur J Prev Cardiol, 2023', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'insight', icon: '🏃', title: 'Strength training slows aging',
    body: 'Resistance training 2× per week reverses gene expression associated with aging at the molecular level. Muscle is the organ of longevity — it regulates glucose, hormones, and metabolism.',
    source: 'Melov et al., PLoS ONE, 2007', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'quote', icon: '🏃', title: 'Process over outcome',
    body: '"You do not rise to the level of your goals. You fall to the level of your systems." Champions don\'t just want to win — they build daily systems that make winning inevitable.',
    source: 'James Clear, Atomic Habits', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'fact', icon: '🏃', title: 'Post-exercise brain boost',
    body: 'A single bout of exercise increases BDNF (brain-derived neurotrophic factor) by 30%. BDNF promotes new neuron growth, improves memory, and enhances learning for 2–3 hours post-exercise.',
    source: 'Rasmussen et al., Exp Physiol, 2009', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'tip', icon: '🏃', title: 'Protein timing window',
    body: 'The "anabolic window" is wider than you think — 24 hours, not 30 minutes. But distributing protein across 4 meals of ~40g each maximizes muscle protein synthesis better than one big meal.',
    source: 'Schoenfeld et al., J Int Soc Sports Nutr, 2013', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'fact', icon: '🏃', title: 'Stretching myth busted',
    body: 'Static stretching before exercise reduces strength by up to 5.5% and power by 2%. Dynamic warmups (leg swings, arm circles, light jogging) are better pre-workout. Save static stretching for after.',
    source: 'Simic et al., Scand J Med Sci Sports, 2013', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'insight', icon: '🏃', title: 'Recovery is when you grow',
    body: 'Muscles don\'t grow during training — they grow during recovery. Overtraining without rest leads to cortisol spikes, immune suppression, and plateau. 1–2 rest days per week is optimal.',
    source: 'Kreher & Schwartz, Sports Health, 2012', color: 'oklch(72% 0.16 30)' },
  { category: 'sports', type: 'tip', icon: '🏃', title: 'Creatine works for the brain too',
    body: 'Creatine monohydrate (5g/day) isn\'t just for muscles. Studies show it improves short-term memory and reasoning, especially under stress or sleep deprivation.',
    source: 'Avgerinos et al., Exp Gerontol, 2018', color: 'oklch(72% 0.16 30)' },

  // ── PSYCHOLOGY ─────────────────────────────────────────────────────────────
  { category: 'psychology', type: 'insight', icon: '🧠', title: 'Loss aversion is 2× stronger',
    body: 'Losing $100 feels twice as painful as gaining $100 feels good. This is why streak tracking works — the fear of losing your streak is more motivating than the joy of building it.',
    source: 'Kahneman & Tversky, Prospect Theory, 1979', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'fact', icon: '🧠', title: 'Decision fatigue is real',
    body: 'After making many decisions, the quality of your choices degrades. Judges were 65% more likely to grant parole at the start of the day vs. end. Front-load important decisions in the morning.',
    source: 'Danziger et al., PNAS, 2011', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'tip', icon: '🧠', title: 'Implementation intentions work',
    body: '"I will [behavior] at [time] in [location]." People who write this specific format are 2–3× more likely to follow through than those who just set goals. Specificity defeats procrastination.',
    source: 'Gollwitzer, Am Psychol, 1999', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'insight', icon: '🧠', title: 'The Zeigarnik effect',
    body: 'Unfinished tasks occupy your mind 90% more than completed ones. Your brain keeps "open loops" running in the background. Writing down your tomorrow action literally frees mental RAM.',
    source: 'Zeigarnik, Psychologische Forschung, 1927', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'fact', icon: '🧠', title: 'Habits form in 66 days (not 21)',
    body: 'The "21 days" myth is wrong. On average, a new behavior becomes automatic in 66 days, ranging from 18 to 254 days. Simple habits form faster. The key is not missing twice in a row.',
    source: 'Lally et al., Eur J Social Psych, 2010', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'tip', icon: '🧠', title: 'Gratitude rewires your brain',
    body: 'Writing 3 things you\'re grateful for each day for 21 days significantly increases optimism for up to 6 months. Gratitude activates the same brain regions as antidepressants.',
    source: 'Emmons & McCullough, J Pers Soc Psych, 2003', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'insight', icon: '🧠', title: 'The progress principle',
    body: 'The single biggest motivator at work isn\'t recognition, incentives, or even meaning — it\'s making progress on meaningful work. Even small wins boost motivation, emotion, and creativity.',
    source: 'Amabile & Kramer, HBR, 2011', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'fact', icon: '🧠', title: 'Willpower is not a muscle',
    body: 'Recent research challenges the "ego depletion" model. Willpower doesn\'t get used up — but your belief that it does becomes a self-fulfilling prophecy. Believing you have willpower gives you more.',
    source: 'Job et al., Psych Science, 2010', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'tip', icon: '🧠', title: 'Environment > motivation',
    body: 'You don\'t need more motivation — you need a better environment. Put your running shoes by the door. Delete social media from your phone. Make the good choice the default choice.',
    source: 'Wendy Wood, Good Habits Bad Habits', color: 'oklch(74% 0.18 280)' },
  { category: 'psychology', type: 'insight', icon: '🧠', title: 'Self-compassion beats self-criticism',
    body: 'Self-criticism after failure leads to less motivation, not more. People who treat setbacks with self-compassion recover faster, try again sooner, and perform better long-term.',
    source: 'Neff, Self-Compassion, 2011', color: 'oklch(74% 0.18 280)' },

  // ── MOTIVATION ─────────────────────────────────────────────────────────────
  { category: 'motivation', type: 'quote', icon: '🔥', title: 'Do it now',
    body: '"The best time to plant a tree was 20 years ago. The second best time is now." Stop waiting for perfect conditions. Start messy, start small, but start today.',
    source: 'Chinese proverb', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'quote', icon: '🔥', title: 'Show up before you feel ready',
    body: '"You don\'t have to be great to get started, but you have to get started to be great." Action creates motivation, not the other way around. Start the task — motivation follows within 5 minutes.',
    source: 'Les Brown', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'insight', icon: '🔥', title: 'The 5-second rule',
    body: 'When you feel the instinct to act on a goal, count 5-4-3-2-1 and physically move. The 5-second window is how long you have before your brain kills the impulse with doubt and excuses.',
    source: 'Mel Robbins', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'quote', icon: '🔥', title: 'Your future self is watching',
    body: '"We suffer more in imagination than in reality." Most things you\'re avoiding right now would take less than 30 minutes to do. The anxiety of avoidance always costs more than the task itself.',
    source: 'Seneca', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'quote', icon: '🔥', title: 'Hard choices, easy life',
    body: '"Hard choices, easy life. Easy choices, hard life." Every time you choose the harder option — waking early, doing the workout, having the difficult conversation — future you benefits.',
    source: 'Jerzy Gregorek', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'insight', icon: '🔥', title: 'Identity drives behavior',
    body: 'Don\'t say "I want to run." Say "I am a runner." Identity-based habits stick because you\'re not chasing an outcome — you\'re becoming the type of person who does the thing naturally.',
    source: 'James Clear, Atomic Habits', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'quote', icon: '🔥', title: 'Discipline equals freedom',
    body: '"Discipline equals freedom." The more disciplined you are with your time, health, and habits, the more freedom you earn in every other area of life. Structure creates space.',
    source: 'Jocko Willink', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'quote', icon: '🔥', title: 'The obstacle is the way',
    body: '"The impediment to action advances action. What stands in the way becomes the way." The thing you\'re resisting most is usually the thing that will move you forward the most.',
    source: 'Marcus Aurelius', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'insight', icon: '🔥', title: 'Progress is not linear',
    body: 'Growth looks like a staircase, not a slope. You\'ll have plateaus that feel like nothing is happening. But underneath, your brain is consolidating. Trust the process. The breakthrough is coming.',
    source: 'Mastery, George Leonard', color: 'oklch(72% 0.18 25)' },
  { category: 'motivation', type: 'quote', icon: '🔥', title: 'Comparison is the thief of joy',
    body: '"Don\'t compare your Chapter 1 to someone else\'s Chapter 20." The only comparison that matters is you vs. yesterday. DECODE tracks exactly that — your daily trajectory, not anyone else\'s.',
    source: 'Theodore Roosevelt (adapted)', color: 'oklch(72% 0.18 25)' },

  // ── SCIENCE ────────────────────────────────────────────────────────────────
  { category: 'science', type: 'fact', icon: '🔬', title: 'Your brain rewires every night',
    body: 'During sleep, your brain replays the day\'s experiences 20× faster, strengthening important neural connections and pruning weak ones. Sleep is not passive rest — it\'s active brain maintenance.',
    source: 'Diekelmann & Born, Nature Reviews Neuro, 2010', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'paper', icon: '🔬', title: 'Neuroplasticity doesn\'t stop',
    body: 'Your brain creates new neurons throughout life (neurogenesis), especially in the hippocampus. Exercise, learning, and sleep are the three strongest triggers. Your brain is never "too old" to change.',
    source: 'Eriksson et al., Nature Medicine, 1998', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'fact', icon: '🔬', title: 'Sunlight affects your DNA',
    body: 'Sunlight exposure activates over 500 genes involved in immune function, circadian rhythm, and vitamin D synthesis. Just 20 minutes of morning sun triggers biological processes that last 24 hours.',
    source: 'Möller-Levet et al., PNAS, 2013', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'paper', icon: '🔬', title: 'Meditation physically changes your brain',
    body: '8 weeks of mindfulness meditation increased gray matter density in the hippocampus (learning/memory) and decreased it in the amygdala (stress/anxiety). Physical structural changes, not just feelings.',
    source: 'Hölzel et al., Psychiatry Research, 2011', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'fact', icon: '🔬', title: 'Your body replaces itself',
    body: 'Most of your body is replaced every 7–10 years. Gut lining: 3–5 days. Skin: 2–3 weeks. Red blood cells: 120 days. Bones: 10 years. You are literally not the same person you were a decade ago.',
    source: 'Spalding et al., Cell, 2005', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'paper', icon: '🔬', title: 'Writing by hand boosts memory',
    body: 'Handwriting activates brain regions associated with learning and memory that typing does not. Students who took notes by hand scored 30% higher on conceptual questions than laptop note-takers.',
    source: 'Mueller & Oppenheimer, Psych Science, 2014', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'fact', icon: '🔬', title: 'The gut-brain axis is bidirectional',
    body: 'Your gut sends more signals to your brain than your brain sends to your gut. The vagus nerve carries 80% of information upward. Gut inflammation directly correlates with anxiety and depression.',
    source: 'Mayer, The Mind-Gut Connection, 2016', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'paper', icon: '🔬', title: 'Social connection extends life',
    body: 'Loneliness increases mortality risk by 26% — equivalent to smoking 15 cigarettes per day. Strong social bonds are a stronger predictor of longevity than exercise, diet, or even quitting smoking.',
    source: 'Holt-Lunstad et al., PLoS Medicine, 2010', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'fact', icon: '🔬', title: 'Stress isn\'t always bad',
    body: 'Viewing stress as "enhancing" rather than "debilitating" changed participants\' cortisol profiles and improved performance under pressure. Your belief about stress literally changes its physiological effect.',
    source: 'Crum et al., J Pers Soc Psych, 2013', color: 'oklch(72% 0.16 200)' },
  { category: 'science', type: 'paper', icon: '🔬', title: 'Nature heals measurably',
    body: 'Just 20 minutes in a natural setting reduces cortisol by 10%. Hospital patients with tree views recovered 1 day faster than those facing brick walls. Nature exposure is medicinal, not just pleasant.',
    source: 'Hunter et al., Front Psychol, 2019', color: 'oklch(72% 0.16 200)' },

  // ── TECH ───────────────────────────────────────────────────────────────────
  { category: 'tech', type: 'insight', icon: '⚡', title: 'AI is the new electricity',
    body: 'Just as electricity transformed every industry 100 years ago, AI is doing the same now. The winners won\'t be those who build AI — but those who apply it to real problems in their domain.',
    source: 'Andrew Ng, Stanford', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'fact', icon: '⚡', title: 'Code quality > code quantity',
    body: 'The best programmers write 10× better code, not 10× more code. Studies show that top developers spend more time thinking and less time typing. The best code is the code you don\'t write.',
    source: 'McConnell, Code Complete', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'tip', icon: '⚡', title: 'Automate the boring stuff',
    body: 'If you do something more than twice, automate it. Shell scripts, keyboard shortcuts, templates — small automations compound into hours saved per week. Invest 30 minutes now, save forever.',
    source: 'Al Sweigart', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'fact', icon: '⚡', title: 'Context switching costs 23 minutes',
    body: 'It takes an average of 23 minutes to refocus after an interruption. Notifications, Slack pings, and tab switching fragment your attention. Batch communications into 2–3 check windows per day.',
    source: 'Mark et al., CHI Conference, 2008', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'insight', icon: '⚡', title: 'Learn tools, not just languages',
    body: 'Mastering your editor, terminal, and debugger gives you more daily productivity than learning a new language. The developer who knows 5 vim shortcuts ships faster than the one who knows 5 languages.',
    source: 'The Pragmatic Programmer', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'fact', icon: '⚡', title: 'Open source runs the world',
    body: '97% of commercial codebases contain open source components. Linux powers 100% of the top 500 supercomputers, 90% of cloud infrastructure, and most of the internet. Open source won.',
    source: 'Synopsys OSSRA Report, 2023', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'tip', icon: '⚡', title: 'Write docs for your future self',
    body: 'The developer who reads your code most is you, 6 months from now. A 2-line comment explaining "why" (not "what") saves hours of archaeology later. Code explains how; comments explain why.',
    source: 'Software engineering wisdom', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'insight', icon: '⚡', title: 'Ship, then iterate',
    body: '"If you\'re not embarrassed by the first version of your product, you launched too late." Real user feedback beats hypothetical planning every time. Ship the MVP. Measure. Iterate.',
    source: 'Reid Hoffman, LinkedIn founder', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'fact', icon: '⚡', title: 'The cloud is someone else\'s computer',
    body: 'Global data centers now use more electricity than some countries. A single ChatGPT query uses 10× the energy of a Google search. The environmental cost of "the cloud" is very physical.',
    source: 'IEA, Data Centres and Data Networks, 2024', color: 'oklch(72% 0.14 250)' },
  { category: 'tech', type: 'tip', icon: '⚡', title: 'Second brain > first brain',
    body: 'Your brain is for having ideas, not storing them. Offload everything — tasks, notes, references — to a digital system. Your "second brain" should be the external hard drive for your mind.',
    source: 'Tiago Forte, Building a Second Brain', color: 'oklch(72% 0.14 250)' },
]

/**
 * Get today's feed items — 3 items per day, rotating through all content
 * deterministically by day-of-year so every user sees the same content.
 */
export function getTodayFeed(dateStr?: string): FeedItem[] {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000
  )
  if (isNaN(dayOfYear) || !isFinite(dayOfYear)) return []

  // Group by category
  const categories: FeedCategory[] = ['business', 'health', 'sports', 'psychology', 'motivation', 'science', 'tech']
  const byCategory = new Map<FeedCategory, FeedItem[]>()
  for (const cat of categories) {
    byCategory.set(cat, FEED_ITEMS.filter(f => f.category === cat))
  }

  // Pick 3 categories for today (rotating)
  const cat1 = categories[dayOfYear % 7]
  const cat2 = categories[(dayOfYear + 2) % 7]
  const cat3 = categories[(dayOfYear + 4) % 7]

  // Pick 1 item from each category (rotating through items)
  const pick = (cat: FeedCategory): FeedItem => {
    const items = byCategory.get(cat)!
    return items[dayOfYear % items.length]
  }

  return [pick(cat1), pick(cat2), pick(cat3)]
}
