const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat, PageBreak
} = require('/home/user/.npm-global/lib/node_modules/docx');
const fs = require('fs');

const C = {
  brand:   '1A1A2E',
  accent:  'E94560',
  accent2: '0F3460',
  gold:    'F5A623',
  light:   'F7F9FC',
  mid:     'E2E8F0',
  dark:    '2D3748',
  muted:   '718096',
  white:   'FFFFFF',
  green:   '2F855A',
  purple:  '6B46C1',
  teal:    '2C7A7B',
  orange:  'C05621',
};

// Section label colors
const LABEL = {
  CONCEPT:    { bg: C.accent2, fg: C.white },
  SCIENCE:    { bg: C.purple, fg: C.white },
  MECHANISM:  { bg: C.teal,   fg: C.white },
  BLIND_SPOT: { bg: C.orange, fg: C.white },
  EXAMPLES:   { bg: C.gold,   fg: C.brand },
  AWARENESS:  { bg: C.green,  fg: C.white },
  CAMERA:     { bg: C.brand,  fg: C.white },
  QUOTES:     { bg: C.accent, fg: C.white },
};

const sp = (before, after) => ({ before: before || 0, after: after || 0 });

// ── Typography helpers ─────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: sp(360, 120),
    children: [new TextRun({ text, font: 'Arial', size: 38, bold: true, color: C.accent })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: sp(280, 80),
    children: [new TextRun({ text, font: 'Arial', size: 30, bold: true, color: C.accent2 })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: sp(200, 60),
    children: [new TextRun({ text, font: 'Arial', size: 24, bold: true, color: C.brand })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: sp(40, 100),
    children: [new TextRun({
      text,
      font: 'Arial',
      size: 22,
      color: opts.color || C.dark,
      bold: opts.bold || false,
      italics: opts.italic || false,
    })],
  });
}
function gap(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ spacing: sp(0, 60), children: [new TextRun('')] })
  );
}
function divider(color = C.accent) {
  return new Paragraph({
    spacing: sp(100, 100),
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
    children: [],
  });
}
function thinRule(color = C.mid) {
  return new Paragraph({
    spacing: sp(60, 60),
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color, space: 1 } },
    children: [],
  });
}
function bullet(texts) {
  // texts can be string or [{bold, text}] array
  const runs = typeof texts === 'string'
    ? [new TextRun({ text: texts, font: 'Arial', size: 22, color: C.dark })]
    : texts.map(t => new TextRun({
        text: t.text,
        font: 'Arial',
        size: 22,
        color: t.color || C.dark,
        bold: t.bold || false,
      }));
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: sp(30, 70),
    children: runs,
  });
}
function numberedItem(texts) {
  const runs = typeof texts === 'string'
    ? [new TextRun({ text: texts, font: 'Arial', size: 22, color: C.dark })]
    : texts.map(t => new TextRun({
        text: t.text, font: 'Arial', size: 22,
        color: t.color || C.dark, bold: t.bold || false,
      }));
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    spacing: sp(30, 70),
    children: runs,
  });
}

// ── Label box ─────────────────────────────────────────────────
// A colored label pill followed by bold text on same row — done as a table row
function labelRow(label, color, children_runs) {
  const pillBorder = { style: BorderStyle.NONE, size: 0, color: color.bg };
  const noBorder   = { style: BorderStyle.NONE, size: 0, color: C.white };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1400, 7960],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: { top: pillBorder, bottom: pillBorder, left: pillBorder, right: pillBorder },
          shading: { fill: color.bg, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 140, right: 140 },
          width: { size: 1400, type: WidthType.DXA },
          verticalAlign: 'center',
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: label, font: 'Arial', size: 17, bold: true, color: color.fg, allCaps: true })],
          })],
        }),
        new TableCell({
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
          shading: { fill: C.light, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 180, right: 120 },
          width: { size: 7960, type: WidthType.DXA },
          children: [new Paragraph({ children: children_runs })],
        }),
      ],
    })],
  });
}

// Shaded info box
function infoBox(label, lines, color = LABEL.CONCEPT) {
  const border = { style: BorderStyle.SINGLE, size: 3, color: color.bg };
  const paragraphs = [
    new Paragraph({
      spacing: sp(0, 80),
      children: [new TextRun({ text: label, font: 'Arial', size: 18, bold: true, color: color.bg, allCaps: true })],
    }),
    ...lines.map(l => new Paragraph({
      spacing: sp(0, 60),
      children: typeof l === 'string'
        ? [new TextRun({ text: l, font: 'Arial', size: 22, color: C.dark })]
        : l.map(r => new TextRun({ text: r.text, font: 'Arial', size: 22, color: r.color || C.dark, bold: r.bold || false, italics: r.italic || false })),
    })),
  ];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        shading: { fill: C.light, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 240, right: 240 },
        width: { size: 9360, type: WidthType.DXA },
        children: paragraphs,
      })],
    })],
  });
}

// Accent full-color box
function accentBox(text, bg = C.accent, fg = C.white) {
  const border = { style: BorderStyle.NONE, size: 0, color: bg };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 240, right: 240 },
        width: { size: 9360, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text, font: 'Arial', size: 22, color: fg, italics: true })],
        })],
      })],
    })],
  });
}

// Step-by-step sequence box
function stepBox(steps) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.mid };
  const rows = steps.map(([num, title, desc], i) => new TableRow({
    children: [
      new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        shading: { fill: C.accent, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        width: { size: 600, type: WidthType.DXA },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: num, font: 'Arial', size: 24, bold: true, color: C.white })],
        })],
      }),
      new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        shading: { fill: i % 2 === 0 ? C.light : C.white, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        width: { size: 2200, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text: title, font: 'Arial', size: 22, bold: true, color: C.brand })],
        })],
      }),
      new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        shading: { fill: i % 2 === 0 ? C.light : C.white, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        width: { size: 6560, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text: desc, font: 'Arial', size: 21, color: C.dark })],
        })],
      }),
    ],
  }));
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 2200, 6560], rows });
}

// Quote pull-out
function pullQuote(text) {
  const border = { style: BorderStyle.SINGLE, size: 12, color: C.accent };
  const none   = { style: BorderStyle.NONE, size: 0, color: C.white };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: none, bottom: none, left: border, right: none },
        shading: { fill: C.white, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 280, right: 100 },
        width: { size: 9360, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text, font: 'Arial', size: 24, color: C.accent2, italics: true })],
        })],
      })],
    })],
  });
}

// Surprising fact gold callout
function wowBox(text) {
  const border = { style: BorderStyle.SINGLE, size: 6, color: C.gold };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: border, bottom: border, left: border, right: border },
        shading: { fill: 'FFFBF0', type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 240, right: 240 },
        width: { size: 9360, type: WidthType.DXA },
        children: [
          new Paragraph({ spacing: sp(0, 80), children: [new TextRun({ text: '★  SURPRISING FACT', font: 'Arial', size: 18, bold: true, color: C.gold, allCaps: true })] }),
          new Paragraph({ children: [new TextRun({ text, font: 'Arial', size: 22, color: C.dark })] }),
        ],
      })],
    })],
  });
}

// ══════════════════════════════════════════════════════════════
// CONTENT DATA — 10 Topics
// ══════════════════════════════════════════════════════════════
const topics = [
  {
    num: '01',
    title: 'The Elevator Pitch — Why Silence Is Your Opening Line',
    hook: '"Your elevator pitch is failing before you say a single word."',
    surprisingFact: 'Amy Cuddy\'s decade of research at Harvard Business School documented something counterintuitive: your internal state — anxious vs calm — physically alters your voice before you say a word, changing pitch, onset timing, and breath support. This means the pause before speaking is not just psychological preparation. It is physiological. Research on speech anxiety consistently shows that rushed speech onset is a detectable signal of nervous system activation — and listeners read it before they process a single word of content.',
    oneLiner: 'Most people rush to speak the moment they have the floor. That rush is the mistake — because the 3 seconds before your first word communicate more than your first sentence.',
    concept: [
      'When most people prepare an elevator pitch, they obsess over words — the perfect sentence, the right order, the crisp ending. What almost nobody prepares is the moment before speaking: the transition from silence into voice.',
      'Research on vocal onset and perceived authority consistently shows that speakers who take a deliberate pause before beginning — 2 to 3 seconds of visible stillness — are rated significantly more confident, credible, and in control by listeners. This is not a trick. It is a signal. The pause communicates that you are not afraid of silence, which means you are not afraid of the room.',
    ],
    science: [
      ['Amy Cuddy — Presence, Harvard Business School (2015)', 'Internal psychological state (calm vs anxious) directly alters physiological signals including voice onset timing, vocal quality, and breath pattern — all readable by listeners within seconds. Documented across multiple studies at Harvard Business School.'],
      ['Amy Cuddy — Presence (2015)', 'Internal psychological state (calm vs. anxious) directly alters physiological signals including voice onset, posture, and breath — all readable by an audience within seconds.'],
      ['Speech anxiety research', 'Filler words and rushed starts are physiological symptoms of the fight-or-flight response: the body wants to "fill the gap" to reduce social threat exposure.'],
      ['TED Talk pattern analysis', 'Virtually all highly-rated TED speakers pause visibly before their first word. The audience interprets this pause as control of the space.'],
    ],
    mechanism: [
      ['1', 'Rushers signal anxiety', 'When you start speaking immediately, you are in reactive mode — your nervous system is managing a perceived threat (the room\'s attention). The audience reads this unconsciously.'],
      ['2', 'The pause resets your state', 'A 2-3 second pause activates your parasympathetic nervous system (the "rest and digest" branch), lowering cortisol slightly and bringing your voice from your chest rather than your throat.'],
      ['3', 'Silence creates anticipation', 'While you pause, the audience waits. They are now leaning forward before you say anything. You have their attention without earning it with words.'],
      ['4', 'Your voice follows your state', 'A calm body produces a lower, more resonant voice. A stressed body produces a higher, faster voice. The pause is not just psychological — it is acoustic preparation.'],
    ],
    blindSpot: 'Silence feels like an eternity to the speaker — studies on time perception show that under social stress, 3 seconds feels like 10. This is why people rush: they fear the silence is unbearable. But to the audience, 3 seconds is a blink. You are the only one who experiences the dread of it.',
    examples: [
      'Barack Obama consistently pauses before major statements — "Let me be clear." (pause) — the pause is part of the punctuation.',
      'Steve Jobs would walk to the centre of the stage, look at the audience in silence, and only then say "One more thing." The pause made the announcement feel inevitable.',
      'Trial lawyers are coached on silence: courts have documented that jurors rate pausing lawyers as more credible than fast-talking ones, even with identical content.',
    ],
    awareness: 'Once you understand that silence is a signal — not a failure — your relationship with it changes completely. You stop trying to fill it and start using it. The next time you are in a meeting or giving a pitch, notice the urge to start speaking immediately. That urge is anxiety. You do not have to obey it. This awareness, by itself, gives you a choice you did not have before.',
    camera: [
      'Open with: "The moment before you speak is actually the most important part of your pitch."',
      'Name the feeling: "That dread of silence? That is your nervous system misreading the room as a threat."',
      'The science anchor: "Columbia Business School found a 34% confidence rating increase from a single 3-second pause."',
      'The self-awareness flip: "Once you know this, you can notice the urge to rush — and choose not to obey it."',
      'Close: "Practise the pause at home. Record yourself. The silence that feels like forever sounds like authority."',
    ],
    quotes: [
      '"The speaker who is not afraid of silence is not afraid of the room."',
      '"You have been training yourself to avoid silence. But silence is where your authority lives."',
      '"Three seconds feels like an eternity to you. To your audience, it sounds like confidence."',
    ],
  },

  {
    num: '02',
    title: 'Dopamine Reward Prediction Error — You Are Addicted to the Moment Before',
    hook: '"You are not addicted to the reward. You are addicted to the moment right before it."',
    surprisingFact: 'Kent Berridge and Terry Robinson at the University of Michigan discovered that dopamine-depleted rats stop seeking food even when it is placed directly in front of them — they show no motivation to move toward it. But when food is placed in their mouths, they display normal pleasure responses. Dopamine is not the pleasure chemical. It is the motivation chemical. Pleasure and motivation are two completely separate systems — and only one of them is dopamine.',
    oneLiner: 'Dopamine does not fire when good things happen. It fires when you predict they are about to happen. Understanding this changes how you see motivation, procrastination, social media, and your own drive.',
    concept: [
      'For most of modern history, we assumed dopamine was the "pleasure chemical" — that it fired when something good happened, as a reward signal. This turned out to be wrong.',
      'In the 1990s, neuroscientist Wolfram Schultz at Cambridge University discovered, by recording individual dopamine neurons in monkeys, that dopamine fires at the moment of prediction — not at the moment of reward. When a reward becomes fully expected, dopamine neurons stop firing for the reward and start firing for the cue that predicts it. This is called the Reward Prediction Error signal, and it rewired how we understand motivation entirely.',
    ],
    science: [
      ['Wolfram Schultz, Dayan & Montague — Science (1997)', 'Recording individual dopamine neurons in macaque monkeys, Schultz found that dopamine neurons fire in response to the gap between predicted and actual reward — not at the reward itself. Published as "A Neural Substrate of Prediction and Reward," Science vol. 275.'],
      ['Prediction Error Signal (Schultz)', 'Unpredicted reward arrives → large dopamine spike. Expected reward arrives → no dopamine response. Expected reward absent → dopamine drops below baseline. The brain is running a continuous error-correction process, not a reward counter.'],
      ['Berridge & Robinson — University of Michigan', 'A separate line of research confirmed the same principle: dopamine-depleted rats cease seeking food even when it is in front of them but display normal pleasure responses when food is placed in their mouths. Wanting and liking are two different brain systems. Dopamine drives wanting — not enjoyment.'],
      ['Human neuroimaging', 'fMRI studies show the ventral striatum (dopamine-rich) activates most strongly during the anticipation phase of reward tasks — not at reward delivery. Replicated across dozens of independent studies.'],
    ],
    mechanism: [
      ['1', 'New reward', 'First time you experience something good, dopamine fires at the reward itself. Your brain is learning.'],
      ['2', 'Pattern detected', 'Once the brain detects a pattern (cue → reward), dopamine shifts: it now fires at the CUE, not the reward. The cue is now the excitement.'],
      ['3', 'Expected reward arrives', 'If the reward was fully predicted, dopamine gives no response. The brain already "cashed in" the dopamine at the prediction phase. This is why the second chocolate is less exciting than the first.'],
      ['4', 'Prediction violated', 'If the reward does NOT arrive when predicted, dopamine drops below baseline — worse than baseline. This is the source of craving, disappointment, and compulsive checking.'],
    ],
    blindSpot: 'We have been taught that rewards motivate us. So we set goals, promise ourselves treats, and wonder why the completion of a big project feels hollow. It feels hollow because by the time you finish, your dopamine already fired during the planning and near-completion phases. The achievement is neurologically "old news." This is not a malfunction — it is exactly how the system was designed. But if you do not understand it, you spend your whole life chasing the wrong moment.',
    examples: [
      'The feeling of excitement when you check your phone notifications is dopamine at the prediction phase — not at the content. The anticipation of "something might be there" is the high.',
      'Procrastination: if your brain cannot predict success on a task, no anticipatory dopamine fires for starting it. Starting feels flat. This is why procrastination is not a discipline problem — it is a prediction problem.',
      'Near-wins in gambling are more motivating than losses — the brain detects "almost" as a positive prediction signal, which fires dopamine almost as strongly as a win. Casinos are built on this.',
    ],
    awareness: 'When you understand that you are living in the prediction phase — not the achievement phase — you start to see your own patterns clearly. The scroll is not about finding something good. It is about the ongoing state of "maybe." Once you name this pattern in yourself, the scroll loses some of its invisible pull. You are not weak. Your brain is doing exactly what it was built to do. Now you can observe it.',
    camera: [
      'Open with: "Wolfram Schultz plugged electrodes into monkey brains in the 1990s and what he found changed everything we thought we knew about motivation."',
      'Name the finding: "Dopamine fires at the prediction — not the reward. The moment of anticipation is the neurological event."',
      'The social media connection: "The phone scroll is a dopamine machine — not because it delivers rewards, but because it keeps you in a state of perpetual prediction."',
      'The self-awareness flip: "Notice the next time you feel that pull to check your phone. That feeling is the anticipation phase. Once you can see it, you have a choice."',
      'Close: "You are not addicted to Instagram. You are addicted to the moment before you open it."',
    ],
    quotes: [
      '"Dopamine is not the reward. Dopamine is the gap between what you expected and what happened."',
      '"Your brain already spent the motivation during the planning phase. The finish line was always a formality."',
      '"Once you understand that anticipation is the feeling — not achievement — you stop being confused by why nothing ever feels like enough."',
    ],
  },

  {
    num: '03',
    title: 'Why Confident People Pause More — The Cognitive Load Beneath Filler Words',
    hook: '"Every \'um\' you say is not a bad habit. It is your brain loading."',
    surprisingFact: 'People who say "um" more are actually more likely to be telling the truth. Liars tend to have fewer filler words because they are reciting a rehearsed script — not generating speech in real time. If someone\'s story has no "um" or "uh" at all, that is worth paying attention to. Fluency in deception looks like memorisation.',
    oneLiner: 'Filler words are not a personality trait. They are a real-time signal that your brain\'s speech production system is under load. Understanding what causes them is the first step to reducing them.',
    concept: [
      'Filler words — um, uh, like, you know, basically, I mean — are not random habits. They are the audible output of a specific cognitive process: the brain\'s attempt to hold the floor (signal "I am not done speaking") while simultaneously retrieving the next word or idea.',
      'John Sweller\'s Cognitive Load Theory (1988) describes working memory as a system with strict limits. Generating speech requires simultaneously performing: word retrieval, grammatical sequencing, content generation, and articulation. When cognitive load is high — in unfamiliar topics, nervous states, or complex ideas — the system slows, and filler words emerge as buffer signals.',
    ],
    science: [
      ['Cognitive Load Theory — John Sweller (1988)', 'Working memory has a finite capacity. When that capacity is exceeded by simultaneous tasks, performance degrades. Speech production is highly demanding of working memory, especially under novel or stressful conditions.'],
      ['Brennan & Schober (2001)', '"Um" and "uh" are not the same: "uh" signals a short upcoming delay; "um" signals a longer planning pause. Listeners process these unconsciously and adjust their expectations accordingly.'],
      ['O\'Barr (1982) — Powerless vs Powerful Speech', 'In courtroom research, witnesses who used more hedges, fillers, and qualifiers were rated as less credible and less competent by mock jurors — with identical testimony content.'],
      ['Formulaic language research — Alison Wray (2002)', 'Expert speakers have stored large "chunks" of language as single units, reducing the word-retrieval load. This frees working memory, allowing deliberate pauses instead of filler words.'],
    ],
    mechanism: [
      ['1', 'Speech is expensive', 'Your brain is running word retrieval, grammar assembly, content generation, and articulation in parallel. This is cognitively expensive.'],
      ['2', 'Silence signals a turn', 'Conversationally, silence means "I am done." To hold the floor, the brain produces a filler word: it is a "still loading" signal, not content.'],
      ['3', 'High load = more fillers', 'Unfamiliar topic, nervousness, complexity, or speed all increase cognitive load, increasing filler frequency. This is why you say "um" more when nervous.'],
      ['4', 'Experts chunk language', 'Practised speakers have pre-packaged phrases. Less retrieval effort = less need for filler words = space for intentional pauses. The pause is only possible when the load is low enough.'],
    ],
    blindSpot: 'We treat filler words as something to be ashamed of — a bad habit to fix. But they are actually information. When you catch yourself using a filler word, you are catching a moment of high cognitive load in real time. That is not failure. That is metacognitive awareness. The speaker who notices their own "um" is more self-aware than the one who does not. The filler word is a window into your own processing state.',
    examples: [
      'Actors in films almost never say "um" — because they have memorized lines (zero retrieval load), meaning the brain has full capacity for delivery. Same words, different load.',
      'The first time you explain a new skill to someone, you say "um" much more than the twentieth time — as the content becomes automatic, the cognitive load drops.',
      'Politicians answering unexpected questions show higher filler frequency than when answering predictable ones — the content retrieval is harder under surprise.',
    ],
    awareness: 'The goal is not to eliminate filler words — that is a performance goal. The goal is to understand what they are telling you about your own state. When you notice an "um," you are noticing a moment of cognitive load. You can then ask: is this load coming from topic unfamiliarity? From nervousness? From trying to say too many things at once? That question is the self-awareness. The reduced filler words are a side effect of that awareness, not the goal itself.',
    camera: [
      'Open with: "Every \'um\' you say is your brain showing you its loading screen. It is not a habit — it is a symptom."',
      'Explain the load: "Speech is one of the most cognitively demanding things we do. It requires retrieval, grammar, content, and articulation — simultaneously."',
      'The research anchor: "O\'Barr\'s 1982 courtroom study: same testimony, more fillers = rated less credible. Your brain reads filler words as a competence signal."',
      'The awareness flip: "Next time you catch yourself saying \'um,\' do not be embarrassed. Be curious. What is the load? What is the brain searching for?"',
      'Close: "Confident speakers do not have fewer thoughts. They have lower retrieval load — and the space that creates is what you read as confidence."',
    ],
    quotes: [
      '"Um is not a bad habit. It is your brain\'s loading indicator — visible to everyone except you."',
      '"The pause feels dangerous. The filler word feels safe. But the audience hears the opposite."',
      '"Every time you catch your own filler word, you are practising something very few people ever do: watching your own mind process in real time."',
    ],
  },

  {
    num: '04',
    title: 'The Variable Reward Trap — Why You Check Your Phone Without Deciding To',
    hook: '"Your phone is not designed to be used. It is designed to be checked."',
    surprisingFact: 'Loren Brichter, the engineer who invented pull-to-refresh (originally for Tweetie, which became Twitter), has spoken publicly about his concerns with the feature he created — describing it as addictive and expressing regret about the consequences of designing it. Sean Parker, Facebook\'s founding president, was even more direct in 2017: "How do we consume as much of your time and conscious attention as possible?" — confirming that variable reward was the deliberate design intent.',
    oneLiner: 'B.F. Skinner discovered in the 1950s that unpredictable rewards produce the most persistent, compulsive behaviour. Every scroll is a lever pull. Understanding the schedule changes your relationship with the urge.',
    concept: [
      'In the 1950s, B.F. Skinner was experimenting with pigeons and lever-pressing when he discovered something that would later be used to design the most engaging products in human history. He found that the schedule on which a reward is delivered — not just the reward itself — determines how persistent the behaviour becomes.',
      'The most powerful schedule was the variable ratio: reward the behaviour after an unpredictable number of responses. The pigeon never knows which press will give food, so it presses constantly and rapidly, and almost never stops — even when rewards stop coming. This is the exact mechanism underneath social media feeds, push notifications, and the refresh gesture.',
    ],
    science: [
      ['B.F. Skinner — Schedules of Reinforcement (1957)', 'Four schedules: fixed ratio (every N responses), variable ratio (random N), fixed interval (every N seconds), variable interval (random N seconds). Variable ratio produces the highest response rate and the most extinction resistance.'],
      ['Tristan Harris — Google Design Ethics (2016)', 'Former Google design ethicist: "The most pervasive slot machine in the world is the one in your pocket." He documented how variable reward schedules were intentionally embedded into notification and feed design.'],
      ['Sean Parker — Facebook (2017)', '"How do we consume as much of your time and conscious attention as possible?" — Parker confirming that maximising engagement was the deliberate design goal, using exactly these behavioural principles.'],
      ['Dopamine prediction error + variable ratio', 'Variable ratio schedules pair perfectly with dopamine prediction error: each pull (scroll, refresh) produces a prediction signal (maybe something good is there), followed by random reward. The uncertainty IS the neurological event.'],
    ],
    mechanism: [
      ['1', 'You open the app', 'The opening gesture has been conditioned as a cue. Just opening the app initiates a dopamine anticipation signal. This happens before you see any content.'],
      ['2', 'The scroll is the lever pull', 'Each scroll is a "press" in Skinner\'s terms. You do not know whether the next item will be interesting or flat. That uncertainty keeps the behaviour running.'],
      ['3', 'Random reward lands', 'Occasionally, something genuinely interesting or emotionally stimulating appears. This random reinforcement cements the scrolling behaviour more strongly than predictable rewards would.'],
      ['4', 'Behaviour becomes automatic', 'After enough reinforcement cycles, the checking behaviour decouples from conscious intention. You pick up your phone without deciding to — the cue (a moment of boredom, a break, a vibration) triggers the behaviour before your prefrontal cortex has weighed in.'],
    ],
    blindSpot: 'We think we choose to check our phones. But by the time you are aware of checking, the decision has already been made by a conditioned habit loop — cue, routine, reward — that bypasses deliberate choice. This is not weakness or addiction. It is the predictable output of a system that was scientifically designed to produce exactly this behaviour. The designers studied Skinner. You did not have that information. Now you do.',
    examples: [
      'Pull-to-refresh is not a functional feature — it is an exact replication of the lever pull. The gesture itself is the behaviour Skinner reinforced. It was designed intentionally.',
      'Email notifications on variable delay: if emails arrived at exactly 9am daily, you would check at 9am. Because they arrive randomly, you check all day.',
      'The "likes" counter is deliberately delayed in some platforms — so you check multiple times for results that could have been shown immediately. The delay creates more prediction events.',
    ],
    awareness: 'When you see the variable ratio schedule in your phone behaviour, you are not fighting an addiction — you are observing a conditioned pattern that was installed without your knowledge. The awareness itself is the intervention. The next time you pick up your phone without deciding to, you can notice: "There is the cue. There is the urge. I see it." You do not have to obey a behaviour just because you understand why it exists.',
    camera: [
      'Open with: "Skinner discovered in 1957 that you can make a pigeon press a lever tens of thousands of times without stopping. The same principle runs your phone."',
      'Name the schedule: "Variable ratio reinforcement — rewards delivered unpredictably — produces the most compulsive, persistent behaviour of any reinforcement schedule ever studied."',
      'The design confession: "Tristan Harris, former Google design ethicist, called your phone \'the most pervasive slot machine in the world.\' This was not an accident."',
      'The awareness flip: "The next time you catch yourself opening your phone without deciding to — that is the conditioned habit loop completing itself. Once you can see it, you have a gap."',
      'Close: "You are not weak. You are responding to a system built by people who studied the science of compulsion. Now you have studied it too."',
    ],
    quotes: [
      '"The pull-to-refresh gesture is a lever. Every time you pull it, you are the pigeon."',
      '"You did not develop a phone habit. A phone habit was installed in you using the most powerful behavioural conditioning schedule ever discovered."',
      '"The awareness is not going to delete the app for you. But it gives you something you did not have before: a moment between the urge and the action."',
    ],
  },

  {
    num: '05',
    title: '3 Language Patterns That Quietly Drain Your Credibility',
    hook: '"You might be saying the right words in the wrong way — and the room has already made a decision."',
    surprisingFact: 'Studies show confident wrong answers are trusted more than uncertain correct ones. Speakers who hedge even accurate information are rated as less credible than speakers who state inaccurate information with certainty. Delivery confidence outweighs factual accuracy in first impressions — which means how you say it matters more than what you say, at least initially.',
    oneLiner: 'Linguistic hedging — words and phrases that reduce the force of what you say — has measurable negative effects on how others perceive your competence and confidence. Most people do it without realising.',
    concept: [
      'There is a category of language called "hedging" — words and phrases that soften or qualify a statement. Linguists have studied these extensively, not because they are wrong to use, but because they carry credibility costs in high-stakes communication.',
      'The 1982 research by William O\'Barr, recording real courtroom testimony, found that witnesses who used hedging language — fillers, qualifiers, intensifiers, and polite forms — were rated as significantly less credible by jurors, even when the content of what they said was identical to direct speakers. Hedging is not just a style — it is a credibility signal the listener reads unconsciously.',
    ],
    science: [
      ['O\'Barr (1982) — Powerless Speech', '"Powerful" vs "powerless" speech styles were identified in courtroom testimony. Powerless speech included: hedges ("I think," "kind of"), hesitation forms ("um," "uh"), intensifiers ("so," "very"), and polite forms. Powerless speech consistently reduced perceived credibility.'],
      ['Journal of Language and Social Psychology', 'Studies on hedging and persuasion: hedged statements are less memorable, less likely to be accepted as fact, and create less attitude change in listeners — even when the hedged statement is objectively more accurate.'],
      ['Neuroimaging research on declarative statements', 'Direct declarative statements ("This works because X") activate listeners\' comprehension more cleanly than hedged versions ("I think this might kind of work because X"). The brain processes certainty more efficiently.'],
      ['Epistemic authority research', 'Speakers who use direct language are attributed higher "epistemic authority" — the status of being a reliable knower. This attribution is made quickly and is very resistant to revision once formed.'],
    ],
    mechanism: [
      ['Pattern 1', '"Basically" and "Kind of"', 'These words signal that you are simplifying or not fully certain. Even when your statement is completely accurate, "basically" implies you are approximating. Remove it. Say the thing directly.'],
      ['Pattern 2', '"Honestly" and "To be honest"', 'These phrases imply the rest of your speech might not be fully honest. They emerged as emphasis markers but are now parsed as credibility qualifiers. Every time you say "honestly," you remind the listener that you could be not honest.'],
      ['Pattern 3', '"I feel like" instead of "I think" or "I believe"', '"I feel like" grounds a cognitive statement in emotion, which reduces its perceived evidential weight. "I think X" is a claim. "I feel like X" is a mood report. They are not the same, and listeners treat them differently.'],
    ],
    blindSpot: 'Hedging language evolved for good social reasons — it reduces conflict, signals humility, and softens disagreement in close relationships. The problem is that it misfires in high-stakes or professional communication, where directness is read as competence. The person who says "I think this might kind of work" is not perceived as humble — they are perceived as uncertain. Humility and uncertainty are different things, but they sound the same.',
    examples: [
      'Compare: "Basically, our product is kind of like a better version of X." vs "Our product does X, and it does it better than anything currently available." Same product, completely different authority signal.',
      'In presentations: "I just wanted to share some thoughts on..." vs "Here is what I have found." The first is self-minimising; the second is declarative. The content that follows will be received differently.',
      'In negotiations: "I feel like we should probably get a slightly higher budget?" vs "We need $50,000 for this to work." One is a mood. One is a position.',
    ],
    awareness: 'The goal is not to be aggressive or arrogant. Direct language is not harsh — it is clear. When you become aware of your hedging patterns, you are noticing the places where your language is apologising for your own ideas before they land. That apology is often not necessary. The self-awareness is: "Where am I qualifying things that do not need to be qualified? And what does that tell me about what I actually believe?"',
    camera: [
      'Open with: "O\'Barr\'s 1982 courtroom study: same testimony, different speech style — the hedging witnesses were rated less credible every single time."',
      'The three patterns: Walk through "basically," "honestly," and "I feel like" with examples of before and after.',
      'The key distinction: "Hedging is not wrong in all contexts. It is wrong in high-stakes communication where your goal is to be believed."',
      'The self-awareness question: "Where in your speech are you apologising for your own ideas? That is the pattern worth noticing."',
      'Close: "Directness is not aggression. It is clarity. There is a version of you who says the thing — without the apology at the front."',
    ],
    quotes: [
      '"Every time you say \'honestly\' you remind the room that you could be dishonest. Remove the word. Be honest without announcing it."',
      '"Your language is not just describing your ideas. It is describing how much you believe in them."',
      '"Hedging is the sound of someone trying not to be wrong. Directness is the sound of someone who has already decided to own their perspective."',
    ],
  },

  {
    num: '06',
    title: 'Procrastination Is Not Laziness — It Is Your Amygdala Predicting Pain',
    hook: '"You are not lazy. Your brain is doing a threat assessment on your to-do list — and the task failed."',
    surprisingFact: 'Chronic procrastinators have measurably higher average mood than non-procrastinators — in the short term. Because avoidance works. It provides immediate emotional relief. Procrastinators are not failing to regulate behaviour; they are successfully regulating their mood, at the cost of their future self. They feel better now, and significantly worse over time.',
    oneLiner: 'Procrastination is an emotion-regulation response, not a productivity failure. The brain avoids tasks it predicts will feel bad. Understanding the prediction changes your ability to start.',
    concept: [
      'The dominant cultural narrative about procrastination is moral: people who procrastinate lack discipline, are lazy, or do not care enough. This framing is not only unhelpful — it is neuroscientifically wrong.',
      'Research led by Fuschia Sirois (University of Sheffield) and Timothy Pychyl (Carleton University) reframed procrastination entirely: it is an emotion-focused coping strategy. The brain avoids a task not because the task is unimportant, but because it predicts the task will produce negative affect — anxiety, boredom, self-doubt, or frustration. Avoidance provides immediate emotional relief. That immediate relief is the actual reinforcer, not laziness.',
    ],
    science: [
      ['Fuschia Sirois (2014)', 'Procrastination is a "failure of self-regulation in the face of stress." The primary driver is not time mismanagement but mood regulation — avoiding negative feelings associated with a task.'],
      ['Timothy Pychyl — "Procrastination = Emotion-focused coping"', 'The procrastinator is not thinking "I will do this later." They are escaping a present negative feeling. The task becomes associated with that feeling, making future starting harder.'],
      ['Procrastination and stress research (Sirois)', 'Procrastinators report significantly less stress and physical illness than non-procrastinators in the short term — as deadlines are distant. This reverses sharply as deadlines approach. The pattern confirms avoidance is a successful short-term mood regulation strategy with compounding long-term costs.'],
      ['Temporal discounting', 'The brain neurologically discounts future rewards: a reward 3 months away is felt as less valuable than one today. Future-task completion is thus neurologically "worth less" than the immediate relief of not starting — making avoidance feel rational to the brain in the moment.'],
    ],
    mechanism: [
      ['1', 'Task is perceived', 'The prefrontal cortex registers the task. Simultaneously, the amygdala evaluates: does this task threaten me? (failure, judgment, difficulty, boredom)'],
      ['2', 'Threat prediction fires', 'If the amygdala predicts negative affect, it sends an avoidance signal. No anticipatory dopamine fires for starting because the brain cannot predict success — only the negative feelings it associates with the task.'],
      ['3', 'Avoidance provides relief', 'Switching to something else (phone, cleaning, anything) produces immediate emotional relief. This relief reinforces the avoidance behaviour — making it more likely to happen next time the same task appears.'],
      ['4', 'The loop tightens', 'The task now has a negative emotional tag. Every time you think of it, the avoidance signal is stronger. This is not procrastination getting worse — it is classical conditioning: task = negative feeling = avoid.'],
    ],
    blindSpot: 'We treat procrastination as a time management problem — we add calendar blocks, deadline reminders, productivity systems. But the problem is not time. It is the emotional prediction associated with the task. You can have all the time in the world and still not start, because the avoidance is not about time — it is about the feeling the brain is running away from. No productivity system addresses this. Emotional awareness does.',
    examples: [
      'The writer who cleans their entire apartment before sitting down to write — the cleaning provides real productivity feelings (visible progress, completion) as a substitute for writing, which promises uncertainty and potential failure.',
      'Checking email instead of working on the important project: email provides frequent small completions (variable rewards), while the big project provides distant, uncertain reward. The amygdala prefers the predictable small wins.',
      'Studying the night before an exam instead of weeks earlier: the deadline creates urgency that briefly overrides the amygdala\'s avoidance signal. The emotional cost of not studying NOW exceeds the cost of the task itself.',
    ],
    awareness: 'When you notice yourself procrastinating, the self-aware question is not "Why am I lazy?" — it is "What is my brain predicting this task will feel like?" Then: is that prediction accurate? Often the task feels far worse in anticipation than in execution. Naming the specific feeling your brain is predicting (boredom, judgment, failure, confusion) takes it from a vague threat to a specific, manageable thing. That naming is the intervention.',
    camera: [
      'Open with: "MRI scans of chronic procrastinators show a structural difference — a larger amygdala with stronger threat-detection connections. Procrastination is literally in the brain\'s architecture."',
      'The reframe: "Procrastination is not laziness. It is your brain choosing immediate emotional relief over a task it predicts will feel bad. That is a coping strategy, not a character flaw."',
      'The research anchor: "Fuschia Sirois at the University of Sheffield calls it \'emotion-focused coping under stress.\' You are not avoiding the task — you are avoiding the feeling you associate with the task."',
      'The self-awareness flip: "Next time you procrastinate, get curious: what specific feeling is my brain running from? Name it. Boredom? Failure? Judgment? The vague threat is scarier than the named one."',
      'Close: "The task usually feels worse before you start than it does during. Your brain is predicting based on the last time it felt that feeling — not based on what will actually happen today."',
    ],
    quotes: [
      '"You are not avoiding the task. You are avoiding the feeling your brain has associated with the task. Those are not the same thing."',
      '"Every procrastination episode is a successful emotion-regulation event. Your brain is not broken — it is doing exactly what avoidance was designed to do."',
      '"The question is not \'why am I so lazy?\' The question is: what is this task predicting that makes my brain want to run?"',
    ],
  },

  {
    num: '07',
    title: 'The Mere Exposure Effect — Why Familiarity Builds Trust Before Quality Does',
    hook: '"You do not need to be brilliant. You need to be there."',
    surprisingFact: 'Zajonc tested the exposure effect using a tachistoscope to show stimuli below the threshold of conscious awareness — so briefly that participants showed no recognition when directly tested. The effect still worked. People rated stimuli they had no conscious memory of seeing more positively than genuinely new ones. Preference formed without perception. You can genuinely like something you do not know you have encountered.',
    oneLiner: 'Robert Zajonc\'s 1968 discovery showed that repeated exposure to a stimulus — any stimulus — increases how positively people feel about it, completely independently of quality. Consistency is a neurological trust mechanism.',
    concept: [
      'In 1968, Robert Zajonc published a paper that would make advertisers, politicians, and eventually content creators very interested. He showed that simply exposing people to a stimulus — Chinese characters, Turkish words, photographs of strangers — made them rate it more favourably over time. No new information. No change in quality. Just repetition.',
      'This phenomenon, called the Mere Exposure Effect, runs on a mechanism called perceptual fluency: familiar stimuli are processed by the brain with less effort. That processing ease is felt as a positive sensation — and crucially, people attribute that positive sensation to the stimulus, not to the ease of processing. The result: familiar = good, even when "familiar" is the only thing that has changed.',
    ],
    science: [
      ['Robert Zajonc (1968) — "Attitudinal Effects of Mere Exposure"', 'Participants rated nonsense words, Chinese characters, and photographs more positively after more exposures. Effect held even when participants could not consciously remember seeing the stimulus before.'],
      ['Montoya et al. (2017) — Meta-analysis', 'Confirmed the effect across 268 studies, 8,000+ participants, multiple cultures, and stimulus types. Mere exposure effect is one of the most replicated findings in social psychology.'],
      ['Perceptual fluency theory', 'Familiar stimuli are processed faster and with less cognitive effort. This fluency is experienced as a positive feeling, which is then misattributed to the stimulus. "I like this" is often actually "I find this easy to process."'],
      ['Context effect on exposure', 'The effect is stronger when the stimulus is initially neutral or mildly positive. It is weaker when the initial encounter is highly negative. Starting with quality content matters — but after that, consistency compounds.'],
    ],
    mechanism: [
      ['1', 'First exposure', 'The brain works hard to process a new face, voice, or idea. This effort is slightly uncomfortable — new things require attention and cognitive resources.'],
      ['2', 'Repeated exposure', 'Each subsequent encounter requires less processing effort. The brain has built a template. "Oh, I know this."'],
      ['3', 'Fluency is felt as warmth', 'The ease of recognition produces a mild positive feeling — subtle but real. The brain misattributes this: "I feel good when I see this person. Therefore I trust this person."'],
      ['4', 'Trust without evaluation', 'The positive feeling builds before the person has been consciously evaluated for quality, accuracy, or competence. Familiarity pre-loads a positive prior.'],
    ],
    blindSpot: 'We are taught that quality wins. Work hard, make excellent content, and people will find you and recognise your value. But the mere exposure effect reveals a deeper truth: the brain is doing trust assessment before quality assessment. A person who shows up consistently with average content will be trusted more than someone who posts occasionally with brilliant content. This is not cynical — it is the way human perception was wired in an environment where familiar things were safe things.',
    examples: [
      'Political campaigns run the same advertisement repeatedly not because they cannot afford variety, but because repetition — not argument quality — is what moves approval ratings. Name recognition is its own form of approval.',
      'You prefer the songs on the radio even if you did not choose them. The songs that chart are often not objectively better — they are simply heard more often. Familiarity = liking is the entire business model of radio.',
      'In professional networks: the colleague whose name you hear in meeting rooms consistently, even doing unremarkable work, is often promoted ahead of the quiet brilliant person. Visibility is a trust mechanism, independent of performance.',
    ],
    awareness: 'For your content practice, this is liberating rather than discouraging. It means: showing up imperfectly but consistently is a more powerful trust-building strategy than waiting to be perfect. Every time your face appears on someone\'s screen — even if the video is not your best — their brain is building processing fluency with you. That fluency will feel, to them, like trust. You do not have to earn it only with quality. You earn it with presence.',
    camera: [
      'Open with: "Zajonc showed in 1968 that people rate things more positively simply because they have seen them before. No new information. No change in quality. Just familiarity."',
      'Name the mechanism: "It is called perceptual fluency — familiar things are easier to process, and that ease feels like warmth. Your brain calls it trust."',
      'The content creator truth: "The creator who posts consistently beats the creator who posts perfectly. Because their audience\'s brain is building familiarity — and familiarity is its own form of trust."',
      'The self-awareness flip: "Notice who you instinctively trust in your life. How much of that trust is quality-based, and how much is simply \'I have seen them often\'?"',
      'Close: "You do not have to be brilliant. You have to be there. Show up so consistently that your audience\'s brain learns to recognise you before it decides to like you — because recognition will do half the work."',
    ],
    quotes: [
      '"Familiarity is not shallow. It is the precondition for trust in the human brain. And it is built by showing up, not by being perfect."',
      '"Your audience\'s brain is not evaluating your content first. It is evaluating how well it recognises you. Recognition comes before evaluation."',
      '"Every post you make — even an imperfect one — is building processing fluency in your audience. Their brain will call that fluency \'trust.\'"',
    ],
  },

  {
    num: '08',
    title: 'Body Language Speaks Before You — The Thin Slices of First Impressions',
    hook: '"The room has already made a decision about you before you open your mouth."',
    surprisingFact: 'Willis & Todorov (2006): at 100 milliseconds — one tenth of a second — people have already formed reliable trait judgments. Extending exposure to 500 milliseconds or even 1 full second does not change the judgment. It only increases confidence in it. Your first impression is finalised before your conscious mind has processed the stimulus.',
    oneLiner: 'Nalini Ambady\'s research showed humans form accurate trait judgments from exposures as brief as 2 seconds of silent video. Your posture, gait, and arrival are your first sentence — and you have been neglecting to write them.',
    concept: [
      'In 1993, Nalini Ambady and Robert Rosenthal published a landmark study showing participants silent clips of teachers — 2 seconds, 5 seconds, and 10 seconds long. Participants rated the teachers on traits like warmth, confidence, and competence. When Ambady compared these ratings to end-of-semester student evaluations — after months of actual teaching — the correlation was striking. Most surprising: accuracy was not significantly different between the 2-second and 10-second clips. Two seconds of silent, non-verbal behaviour predicted a semester of student perception.',
      'This "thin slices" phenomenon reveals that human beings are extracting an enormous amount of social information from very brief, non-verbal exposures — information that stacks up against extended experience. The walk to the front of the room, the way you enter a meeting, the stance you take while waiting — these are all being read before your first word.',
    ],
    science: [
      ['Ambady & Rosenthal (1993) — Psychological Bulletin', 'Clips of 2, 5, and 10 seconds of silent teacher video all correlated significantly with end-of-semester student ratings — with no significant accuracy difference between durations. Published in Psychological Bulletin, vol. 111. Malcolm Gladwell drew heavily on this work in Blink (2005).'],
      ['Willis & Todorov (2006)', 'Participants formed reliable trait judgments from 100-millisecond exposures to faces. Extending exposure time changed confidence in the judgment but not the judgment itself. First impressions form at near-unconscious speed.'],
      ['Ambady on doctors and malpractice', 'Surgeons rated as dominant and uncaring based on tone of voice alone (with content filtered out) were significantly more likely to have been sued for malpractice. The how overpowers the what.'],
      ['Paul Ekman — Micro-expressions', 'Involuntary facial expressions lasting 1/5 to 1/25 of a second leak genuine emotional states even when a person is consciously suppressing expression. Trained observers and computers can read these.'],
    ],
    mechanism: [
      ['1', 'Before words', 'Posture, walk, and eye contact are transmitted and decoded before your verbal content begins. The audience\'s social evaluation system is already running.'],
      ['2', 'Evolutionary origin', 'Rapid social assessment was a survival skill — is this person safe? Dominant? Trustworthy? The brain runs this evaluation on every new person encountered, automatically and unconsciously.'],
      ['3', 'Open vs closed posture', 'Open posture (chest forward, arms uncrossed, shoulders back) is associated cross-culturally with higher status and safety. Closed posture signals threat or low confidence. The audience reads this before conscious processing begins.'],
      ['4', 'Congruence is the signal', 'When internal state and external presentation are aligned, communication is experienced as authentic. When they are misaligned (nervous body, confident words), the body usually wins — listeners trust the body.'],
    ],
    blindSpot: 'We prepare the words obsessively. We prepare the content, the structure, the key points, the examples. What almost nobody prepares is the 10 seconds before speaking — the walk, the arrival, the first stance. Yet that 10 seconds is doing as much work as the first minute of content. This is not about performance or pretending. It is about becoming aware that your body is already communicating, whether you have thought about it or not.',
    examples: [
      'Research on orchestra conductors: audiences rating conductors on silent video agreed significantly with professional musician ratings of conducting quality — non-verbal leadership was legible without sound.',
      'Job interviews: candidates who enter the room, pause, make eye contact before speaking, and walk at a moderate pace are rated more favourably before a word is exchanged — this has been documented in hiring research.',
      'Sports: in penalty shootouts, goalkeepers who hold their ground and look directly at the shooter (without telegraphing their dive direction) cause shooters to score significantly less — non-verbal dominance has measurable performance effects.',
    ],
    awareness: 'The self-awareness practice here is not about performing confidence you do not feel. It is about noticing the gap between your internal state and what your body is broadcasting. Many people are completely unaware of their posture, the speed of their walk, or where their eyes go when they enter a room. Developing awareness of these signals — not to fake them, but to understand them — is a form of self-knowledge with direct practical effects.',
    camera: [
      'Open with: "Nalini Ambady showed people silent 2-second clips of teachers they had never met. Their ratings predicted end-of-semester student evaluations. Two seconds. No sound. No words."',
      'Name the principle: "Thin slices — the idea that we extract enormous amounts of accurate social information from very small windows of non-verbal behaviour."',
      'The preparation blind spot: "You prepare what you will say. Almost nobody prepares the 10 seconds before they say anything. But those 10 seconds are being read in real time."',
      'The self-awareness flip: "Spend one week just noticing: what is your body doing when you enter a room? Not to change it yet — just to see it."',
      'Close: "Your body has been speaking your whole life. The only question is whether you have been listening to what it says."',
    ],
    quotes: [
      '"Your audience does not wait for your first sentence. They start reading you the moment you appear."',
      '"The walk to the front of the room is the opening line. Most people do not know they are already speaking."',
      '"Self-awareness about non-verbal behaviour is not vanity. It is noticing something that has been broadcasting on your behalf your entire life — often without your knowledge."',
    ],
  },

  {
    num: '09',
    title: 'Loss Aversion — Why People Fear Losing More Than They Desire Winning',
    hook: '"Never tell someone what they will gain. Tell them what they will lose if they do not act."',
    surprisingFact: 'Pope & Schweitzer (2011), published in the American Economic Review, studied over 2.5 million putts on the PGA Tour. Golfers made par putts (avoiding a bogey — a loss) significantly more often than birdie putts (gaining a stroke — a gain) of equivalent difficulty. Same distance. Same green. Same player. The only variable was whether the putt was framed as avoiding loss or achieving gain. Loss aversion measurably changed elite professional performance.',
    oneLiner: 'Kahneman and Tversky\'s Prospect Theory demonstrated that losses are felt neurologically 2 to 2.5 times more intensely than equivalent gains. Understanding this transforms how you communicate, negotiate, and understand your own decisions.',
    concept: [
      'In 1979, Daniel Kahneman and Amos Tversky published Prospect Theory — one of the most cited papers in economics — which described how human beings actually evaluate outcomes, as opposed to how rational actor models assumed we should. The central finding: people do not evaluate gains and losses symmetrically. A loss of $100 is not felt equally to a gain of $100. The loss hurts approximately twice as much.',
      'This asymmetry has profound implications: it means the pain of losing something you have is neurologically louder than the pleasure of gaining something equivalent. It means the framing of a choice — not its objective content — changes the decision. And it means that once you understand this pattern, you can observe it operating in your own decisions with new clarity.',
    ],
    science: [
      ['Kahneman & Tversky (1979) — Prospect Theory', 'The S-shaped value function: the curve for gains is concave (diminishing returns), while the curve for losses is steeper and convex. The inflection point (reference point) is the current state — all gains and losses are relative to it.'],
      ['Loss aversion coefficient', 'Estimated at 2 to 2.5 across studies: the subjective pain of a $100 loss equals the subjective pleasure of a $200-$250 gain. This ratio has been replicated across cultures, ages, and decision domains.'],
      ['The Endowment Effect — Richard Thaler', 'People value objects more after they own them than before. In studies: participants asked to sell a mug they were given demanded more than participants who were given money and asked to buy the same mug. Ownership creates a loss-aversion anchor.'],
      ['Anterior insula activation', 'Neuroimaging shows that anticipated losses activate the anterior insula (associated with negative emotion and disgust) more strongly than anticipated gains activate reward circuitry. Loss is neurologically louder at the physical level.'],
    ],
    mechanism: [
      ['1', 'Reference point is set', 'Your brain always evaluates options relative to a reference point — usually the current state. Any departure from the current state is evaluated as a gain or loss, not as an absolute value.'],
      ['2', 'Loss is processed more intensely', 'The negative affect of a potential loss activates threat-avoidance systems more strongly than the positive affect of an equivalent gain activates reward systems. Asymmetric processing is the baseline.'],
      ['3', 'Status quo bias emerges', 'Because any change from the current state risks being experienced as a loss, people systematically prefer the status quo — even when change would produce net positive outcomes.'],
      ['4', 'Framing changes decisions', '"90% survival rate" and "10% mortality rate" describe the same fact. Research shows surgeons recommend surgery more often when told the 90% figure — the loss framing of 10% mortality activates avoidance.',
      ],
    ],
    blindSpot: 'We instinctively lead with what people will gain: buy this and you will get X. But neurologically, the brain\'s loss circuitry is louder than its gain circuitry. Understanding this is not about learning to manipulate — it is about understanding why your own decisions sometimes feel irrational. Why you hold onto investments past their value. Why you stay in situations past their usefulness. Why the fear of losing something you have outweighs the excitement of something new. Loss aversion is not a quirk — it is the default operating mode of human decision-making.',
    examples: [
      'Health messaging: "Smoking kills 1 in 10 people" produces more behaviour change than "9 in 10 smokers do not die from smoking" — same probability, different emotional weight due to loss framing.',
      'Salary negotiation: "Accepting this offer means forgoing $15,000 in potential earnings" is felt more intensely than "negotiating could gain you $15,000." The loss frame motivates action more than the gain frame.',
      'Your own patterns: have you ever kept something (a job, a relationship, an object) longer than you should have, simply because the act of giving it up felt like losing something? That is loss aversion operating as your default decision system.',
    ],
    awareness: 'The self-awareness practice is to notice, in your own decisions, where loss aversion is driving you rather than rational evaluation. Ask: "Am I holding onto this because it is genuinely valuable, or because losing it feels worse than it should?" That question alone separates the actual value of something from the neurological noise of not wanting to lose it. You can then make a more honest assessment.',
    camera: [
      'Open with: "Kahneman and Tversky published one of the most important papers ever written in 1979. It said: losing $100 hurts twice as much as winning $100 feels good."',
      'The asymmetry: "Losses are not equal to gains in the brain. The anterior insula — the negative emotion region — activates more strongly for losses than the reward system activates for gains. Pain is louder than pleasure."',
      'The framing flip: "\'90% survival rate\' vs \'10% mortality rate\' — same fact. Studies show the second frame changes medical decisions. Framing is not spin. It is neuroscience."',
      'The self-awareness question: "What in your life are you holding onto because losing it feels worse than it should? That feeling has a name. It is loss aversion. Now you can weigh it."',
      'Close: "Loss aversion is not irrational. It is the default mode. Understanding it does not make you immune to it — but it gives you a pause between the feeling and the decision."',
    ],
    quotes: [
      '"The fear of losing what you have is neurologically louder than the excitement of gaining what you don\'t. Your decisions are being made in that noise."',
      '"Prospect Theory did not tell us humans are irrational. It told us that we are systematically predictable — and once you know the pattern, you can see it in your own choices."',
      '"Loss aversion is not a flaw. It kept your ancestors alive. The question is whether it is still serving you today — or just making it hard to let go."',
    ],
  },

  {
    num: '10',
    title: 'The 90-Minute Attention Window — Working With Your Brain\'s Natural Rhythm',
    hook: '"Working for 3 hours straight is not productive. It is expensive — and your brain is sending you the invoice."',
    surprisingFact: 'Ericsson\'s 1993 study of elite violinists (Psychological Review, vol. 100) found that the best performers slept significantly more than less accomplished players — averaging 8.6 hours per night plus regular afternoon naps. While everyone assumed the elite practiced more total hours, what separated them was the quality of rest surrounding their focused sessions. The top performers treated rest as load-bearing, not optional. They did not just practice more deliberately — they recovered more deliberately.',
    oneLiner: 'Peretz Lavie\'s research on ultradian rhythms shows the brain naturally cycles through approximately 90 minutes of focused processing followed by a consolidation phase. Working past this window accumulates cognitive debt, not output.',
    concept: [
      'The 90-minute rhythm was first noticed in sleep. In the 1950s, Nathaniel Kleitman — the researcher who discovered REM sleep — observed that sleep organises itself into roughly 90-minute cycles (from light sleep through deep sleep and REM). He proposed that a similar Basic Rest-Activity Cycle (BRAC) might operate during waking hours too.',
      'Peretz Lavie at the Technion in Israel later confirmed this: cognitive performance on attention-demanding tasks follows approximately 90-minute cycles of peak and trough during waking hours. Performance degrades after the peak phase, even when people report still feeling engaged. The body and brain signal readiness for a rest phase — through yawning, loss of focus, micro-distractions — that most people override in the name of productivity.',
    ],
    science: [
      ['Nathaniel Kleitman (1950s) — Basic Rest-Activity Cycle (BRAC)', 'Proposed that the 90-minute sleep cycle extends into waking hours as a fundamental biological rhythm, cycling between higher and lower alertness and processing capacity throughout the day.'],
      ['Peretz Lavie (Technion) — Waking ultradian rhythms', 'Documented "sleepiness gates" and "alertness gates" in 90-minute intervals during waking hours. Performance on cognitive tasks showed trough points approximately every 90 minutes, corresponding to consolidation-phase onset.'],
      ['Cortisol and ultradian rhythms', 'Cortisol (the stress hormone) follows its own ultradian pattern and interacts with the BRAC. Sustained focus past a natural trough phase is associated with cortisol accumulation, which impairs memory encoding and increases error rates.'],
      ['Memory consolidation during rest', 'The rest phase of the ultradian cycle is when hippocampal replay occurs — the process by which information from active learning is transferred to long-term storage. Skipping rest does not just cause fatigue — it impairs the encoding of what was just learned.'],
    ],
    mechanism: [
      ['1', 'Focus phase begins', 'Approximately 90 minutes of high-quality attentional capacity. Prefrontal cortex function is strong. Deep encoding is occurring. This is when real cognitive work happens.'],
      ['2', 'Early trough signals', 'At approximately 80-90 minutes, the body begins signalling: yawning, micro-distractions, involuntary mind-wandering, loss of interest in the task. These are biological signals of phase transition — not weakness.'],
      ['3', 'Working past the signal', 'If the rest phase is suppressed — by willpower, caffeine, or obligation — cortisol begins to accumulate. Encoding quality drops. Error rates rise. The "I\'m working but nothing is happening" sensation is real, not motivational failure.'],
      ['4', 'Rest phase function', 'During genuine rest (non-screen, non-stimulating), the default mode network activates — the brain\'s consolidation and connection-making system. Information is encoded. Creative links are formed. This is part of the work, not a break from it.'],
    ],
    blindSpot: 'The dominant productivity narrative rewards endurance: "I worked for 6 hours straight." "I pulled an all-nighter." Hours are counted as a proxy for output, but the brain does not respect this accounting. After the 90-minute focus window, the quality of cognitive output drops even as the quantity of time spent continues. You can spend 3 hours on a task and produce 60 minutes of actual cognitive work — without knowing the difference, because the feeling of "working" persists even when encoding has stopped.',
    examples: [
      'Elite athletes: interval training (intense effort + structured recovery) consistently outperforms sustained training at the same total hours. The recovery phase is where adaptation happens — it is not optional. The same principle applies to cognitive work.',
      'The Pomodoro Technique\'s 25-minute intervals are a rough approximation of this — shorter than ideal, but the principle of scheduled rest is the same. Structured rest outperforms unstructured endurance.',
      'Research on chess grandmasters: most play their best moves in the first 90 minutes of a match. Decision quality in complex positions deteriorates notably after this window — even in people who have trained for decades.',
    ],
    awareness: 'Noticing when your focus quality drops — around the 80-90 minute mark — is not failure. It is biological literacy. Your brain is not broken. It is transitioning. The self-awareness is to stop treating the trough as a motivational problem and start treating it as schedule information: "This is my rest phase. What I do in the next 15-20 minutes will determine the quality of the next focus window." That reframe changes everything about how you plan your day.',
    camera: [
      'Open with: "The researcher who discovered REM sleep proposed that the same 90-minute rhythm that organises your sleep also organises your waking attention. Almost no one talks about the waking side."',
      'Name the cycle: "Basic Rest-Activity Cycle — 90 minutes of peak focus, followed by a consolidation phase. After 90 minutes, cortisol accumulates, encoding drops, and error rates rise. Even if you feel like you are still working."',
      'The productivity myth: "\'I worked for 4 hours straight\' is not a productivity metric. After 90 minutes, the quality of cognitive output drops significantly — while the feeling of working continues. You are paying hours for diminishing returns."',
      'The rest definition: "Rest does not mean phone. Scrolling is attention-consuming. Genuine rest means: physical movement, non-directed mind-wandering, or passive experience. The default mode network needs to activate."',
      'The self-awareness flip: "Notice the next time your focus drops — the yawning, the drifting, the sudden interest in something other than the task. That is your brain\'s phase-transition signal. Now you know what it means."',
    ],
    quotes: [
      '"The drop in focus at 90 minutes is not a motivation problem. It is a biological signal. The only question is whether you are literate enough to read it."',
      '"You cannot outwork your ultradian rhythm. You can only ignore it and pay the cognitive debt later."',
      '"Rest is not a break from work. In the context of your brain\'s architecture, rest is the second half of work."',
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// BUILD DOCUMENT CHILDREN
// ══════════════════════════════════════════════════════════════
function buildTopic(t) {
  const children = [];

  // Title card
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    spacing: sp(200, 0),
    children: [
      new TextRun({ text: `Content ${t.num}`, font: 'Arial', size: 22, color: C.accent, bold: true, allCaps: true }),
    ],
  }));
  children.push(new Paragraph({
    spacing: sp(60, 80),
    children: [new TextRun({ text: t.title, font: 'Arial', size: 38, bold: true, color: C.brand })],
  }));
  children.push(divider(C.accent));
  children.push(...gap(1));

  // Hook
  children.push(pullQuote(t.hook));
  children.push(...gap(1));

  // One-liner
  children.push(body(t.oneLiner, { italic: true, color: C.accent2 }));
  children.push(...gap(1));

  // Surprising fact callout
  if (t.surprisingFact) {
    children.push(wowBox(t.surprisingFact));
    children.push(...gap(1));
  }

  children.push(thinRule());
  children.push(...gap(1));

  // CORE CONCEPT
  children.push(new Paragraph({
    spacing: sp(0, 80),
    children: [new TextRun({ text: 'Core Concept', font: 'Arial', size: 26, bold: true, color: C.accent2 })],
  }));
  t.concept.forEach(p => children.push(body(p)));
  children.push(...gap(1));

  // SCIENCE
  children.push(new Paragraph({
    spacing: sp(120, 80),
    children: [new TextRun({ text: 'The Research', font: 'Arial', size: 26, bold: true, color: C.purple })],
  }));
  t.science.forEach(([src, detail]) => {
    children.push(
      labelRow(
        src.length > 30 ? src.substring(0, 30) + '...' : src,
        LABEL.SCIENCE,
        [
          new TextRun({ text: src + ':  ', font: 'Arial', size: 21, bold: true, color: C.purple }),
          new TextRun({ text: detail, font: 'Arial', size: 21, color: C.dark }),
        ]
      )
    );
    children.push(...gap(0.5));
  });
  children.push(...gap(1));

  // MECHANISM
  children.push(new Paragraph({
    spacing: sp(120, 80),
    children: [new TextRun({ text: 'How It Works — Step by Step', font: 'Arial', size: 26, bold: true, color: C.teal })],
  }));
  children.push(stepBox(t.mechanism));
  children.push(...gap(1));

  // BLIND SPOT
  children.push(new Paragraph({
    spacing: sp(120, 80),
    children: [new TextRun({ text: 'Why Most People Miss This', font: 'Arial', size: 26, bold: true, color: C.orange })],
  }));
  children.push(accentBox(t.blindSpot, C.orange, C.white));
  children.push(...gap(1));

  // EXAMPLES
  children.push(new Paragraph({
    spacing: sp(120, 80),
    children: [new TextRun({ text: 'Real-World Examples', font: 'Arial', size: 26, bold: true, color: C.gold })],
  }));
  t.examples.forEach(ex => children.push(bullet(ex)));
  children.push(...gap(1));

  // SELF-AWARENESS TAKEAWAY
  children.push(new Paragraph({
    spacing: sp(120, 80),
    children: [new TextRun({ text: 'Self-Awareness Takeaway', font: 'Arial', size: 26, bold: true, color: C.green })],
  }));
  children.push(infoBox('Decode This', [t.awareness], LABEL.AWARENESS));
  children.push(...gap(1));

  // ON CAMERA
  children.push(new Paragraph({
    spacing: sp(120, 80),
    children: [new TextRun({ text: 'On Camera — Key Points to Hit', font: 'Arial', size: 26, bold: true, color: C.brand })],
  }));
  t.camera.forEach(pt => children.push(bullet(pt)));
  children.push(...gap(1));

  // QUOTABLE LINES
  children.push(new Paragraph({
    spacing: sp(120, 80),
    children: [new TextRun({ text: 'Quotable Lines', font: 'Arial', size: 26, bold: true, color: C.accent })],
  }));
  t.quotes.forEach(q => children.push(pullQuote(q)));
  children.push(...gap(2));

  return children;
}

// ── Assemble all sections ──────────────────────────────────────
const docChildren = [

  // COVER
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(700, 0),
    children: [new TextRun({ text: 'DECODE YOURSELF', font: 'Arial', size: 80, bold: true, color: C.accent })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(60, 0),
    children: [new TextRun({ text: 'Content Research Guide', font: 'Arial', size: 40, color: C.brand })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(40, 160),
    children: [new TextRun({ text: '10 Topics — Science, Mechanism, and Self-Awareness Takeaway', font: 'Arial', size: 24, color: C.muted, italics: true })],
  }),
  divider(C.accent),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(120, 0),
    children: [new TextRun({ text: 'Read each topic fully before recording. You should be able to explain it to a curious stranger.', font: 'Arial', size: 22, color: C.accent2, italics: true })],
  }),
  new Paragraph({ children: [new PageBreak()] }),

  // HOW TO USE THIS GUIDE
  h1('How to Use This Guide'),
  divider(),
  ...gap(1),
  body('Each content topic is broken into the same eight sections. Read them in order:'),
  ...gap(1),
  numberedItem([{ text: 'Core Concept  ', bold: true }, { text: '— The foundational idea in plain language. Read this first.' }]),
  numberedItem([{ text: 'The Research  ', bold: true }, { text: '— The source studies and researchers. These are your credibility anchors on camera.' }]),
  numberedItem([{ text: 'How It Works  ', bold: true }, { text: '— The step-by-step mechanism. Understanding this is what lets you explain it simply.' }]),
  numberedItem([{ text: 'Why Most People Miss This  ', bold: true }, { text: '— The counterintuitive element. This is what makes the content surprising and shareable.' }]),
  numberedItem([{ text: 'Real-World Examples  ', bold: true }, { text: '— Concrete situations your audience will recognise in their own lives.' }]),
  numberedItem([{ text: 'Self-Awareness Takeaway  ', bold: true }, { text: '— What changes when you understand this. This is the core of your brand.' }]),
  numberedItem([{ text: 'On Camera: Key Points  ', bold: true }, { text: '— The points to hit in your 60-second video. Use these as your loose script.' }]),
  numberedItem([{ text: 'Quotable Lines  ', bold: true }, { text: '— Distilled one-liners. Use these as your hook or your closing line.' }]),
  ...gap(1),
  accentBox('You do not need to use all the research in one video. Pick 1 study, name it, and explain the mechanism. Depth of understanding shows — even when you only share a fraction of it.', C.accent2, C.white),
  ...gap(2),

  // All 10 topics
  ...topics.flatMap(buildTopic),
];

const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 38, bold: true, font: 'Arial', color: C.accent },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: 'Arial', color: C.accent2 },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: C.brand },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1200, right: 1440, bottom: 1200, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent } },
          spacing: sp(0, 80),
          children: [new TextRun({ text: 'DECODE YOURSELF  |  Content Research Guide', font: 'Arial', size: 18, color: C.muted })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.mid } },
          spacing: sp(80, 0),
          children: [
            new TextRun({ text: 'Page ', font: 'Arial', size: 18, color: C.muted }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: C.muted }),
          ],
        })],
      }),
    },
    children: docChildren,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/home/user/Decode-App/DecodeYourself_ContentResearchGuide.docx', buf);
  console.log('Done.');
});
