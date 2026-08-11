'use strict';

/**
 * WinOnAny PDF Generator
 * Run with: node lib/generate-pdfs.js
 * Outputs three PDFs to /pdfs/
 */

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUT_DIR = path.join(__dirname, '../pdfs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  void:       '#050507',
  panel:      '#0B0B0F',
  surface:    '#131318',
  line:       '#1C1C24',
  text:       '#F2F2F4',
  muted:      '#85858F',
  muted2:     '#5C5C66',
  accent:     '#6E56F8',
  accentLift: '#8B78FF',
  gold:       '#C9A84C',
};

function hex(h) {
  const r = parseInt(h.slice(1,3),16);
  const g = parseInt(h.slice(3,5),16);
  const b = parseInt(h.slice(5,7),16);
  return [r,g,b];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bg(doc, color) {
  doc.rect(0,0,doc.page.width,doc.page.height).fill(color);
}

function accentBar(doc) {
  doc.rect(0,0,doc.page.width,3).fill(C.accent);
}

function sectionDivider(doc) {
  doc.moveDown(.5);
  doc.rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left*2, 1).fill(C.line);
  doc.moveDown(1);
}

function chapterCover(doc, num, title, subtitle) {
  doc.addPage();
  bg(doc, C.void);
  accentBar(doc);

  // Chapter number — large faint
  doc.font('Helvetica').fontSize(120).fillColor(C.line)
    .text('0'+num, doc.page.margins.left, 120, { align: 'left' });

  doc.moveDown(0);
  doc.font('Helvetica-Bold').fontSize(36).fillColor(C.text)
    .text(title, doc.page.margins.left, 240, { lineGap: 4 });

  doc.font('Helvetica').fontSize(16).fillColor(C.muted)
    .text(subtitle, { lineGap: 6 });
}

function contentPage(doc) {
  doc.addPage();
  bg(doc, C.void);
  accentBar(doc);
  doc.y = doc.page.margins.top + 16;
}

function kicker(doc, text) {
  doc.font('Courier').fontSize(9).fillColor(C.muted2)
    .text(text.toUpperCase(), { characterSpacing: 2, lineGap: 2 });
  doc.moveDown(.4);
}

function heading(doc, text) {
  doc.font('Helvetica-Bold').fontSize(22).fillColor(C.text)
    .text(text, { lineGap: 3 });
  doc.moveDown(.5);
}

function subheading(doc, text) {
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.accentLift)
    .text(text, { lineGap: 2 });
  doc.moveDown(.3);
}

function body(doc, text) {
  doc.font('Helvetica').fontSize(11).fillColor(C.muted)
    .text(text, { lineGap: 5, paragraphGap: 4 });
  doc.moveDown(.6);
}

function callout(doc, text) {
  const x   = doc.page.margins.left;
  const w   = doc.page.width - doc.page.margins.left*2;
  const pad = 16;
  const startY = doc.y;

  // Measure text height
  const h = doc.heightOfString(text, { width: w - pad*2 - 4, fontSize: 11 }) + pad*2;

  doc.rect(x, startY, w, h).fill(C.surface);
  doc.rect(x, startY, 3, h).fill(C.accent);

  doc.font('Helvetica').fontSize(11).fillColor(C.text)
    .text(text, x + pad + 4, startY + pad, { width: w - pad*2 - 4, lineGap: 4 });

  doc.y = startY + h + 12;
  doc.moveDown(.4);
}

function bullet(doc, text) {
  const x = doc.page.margins.left;
  const bx = x + 2;
  const tx = x + 18;
  const w  = doc.page.width - tx - doc.page.margins.right;

  doc.circle(bx + 3, doc.y + 5.5, 2).fill(C.accent);
  doc.font('Helvetica').fontSize(11).fillColor(C.muted)
    .text(text, tx, doc.y, { width: w, lineGap: 4 });
  doc.moveDown(.25);
}

function pageFooter(doc, label) {
  const y = doc.page.height - 38;
  doc.font('Courier').fontSize(8).fillColor(C.muted2)
    .text('WINONANY — PRIVATE ACCESS ONLY', doc.page.margins.left, y, { characterSpacing: 1.5 });
  doc.font('Courier').fontSize(8).fillColor(C.muted2)
    .text(label, 0, y, { align: 'right', characterSpacing: 1 });
}

function coverPage(doc, tier, tagline, color) {
  bg(doc, C.void);
  // Top accent bar
  doc.rect(0, 0, doc.page.width, 4).fill(color || C.accent);
  // Side accent bar
  doc.rect(0, 0, 4, doc.page.height).fill(color || C.accent);

  // WinOnAny wordmark
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.muted2)
    .text('WINONANY', doc.page.margins.left + 10, 52, { characterSpacing: 3 });

  // Tier badge
  doc.font('Courier').fontSize(9).fillColor(color || C.accent)
    .text(tier.toUpperCase(), doc.page.margins.left + 10, 74);

  // Main title
  doc.font('Helvetica-Bold').fontSize(52).fillColor(C.text)
    .text('Win on\nany platform.', doc.page.margins.left + 10, 180, { lineGap: 4 });

  // Tagline
  doc.font('Helvetica').fontSize(15).fillColor(C.muted)
    .text(tagline, doc.page.margins.left + 10, 380, { lineGap: 6, width: 340 });

  // Bottom line
  doc.rect(doc.page.margins.left + 10, doc.page.height - 60, 60, 1).fill(color || C.accent);
  doc.font('Courier').fontSize(8).fillColor(C.muted2)
    .text('PRIVATE ACCESS ONLY — DO NOT SHARE', doc.page.margins.left + 10, doc.page.height - 48);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF 1 — STARTER ($49)
// ═══════════════════════════════════════════════════════════════════════════════

function buildStarter() {
  const doc = new PDFDocument({ size: 'A4', margins: { top:56, left:56, right:56, bottom:56 }, autoFirstPage: true });
  const out = fs.createWriteStream(path.join(OUT_DIR, 'winonany-starter.pdf'));
  doc.pipe(out);

  // ── Cover ──
  coverPage(doc, 'Starter', 'The entry point. Profile setup, opening scripts, and the frameworks that get conversations moving in the right direction.', C.accent);

  // ── Chapter 1: Profile Advantage ──
  chapterCover(doc, 1, 'Profile\nAdvantage.', 'What your profile says before you say anything.');

  contentPage(doc);
  kicker(doc, 'Chapter 01 — Profile Advantage');
  heading(doc, 'She decides before you speak.');
  body(doc, 'Before a single message is sent, she\'s already made a call on you. Your profile isn\'t just photos — it\'s a signal. The right signal tells her exactly what kind of guy you are and where this is likely to go. The wrong one ends it before it starts.');
  body(doc, 'Most guys treat their profile like a resume. That\'s the problem. She\'s not hiring. She\'s deciding whether she\'s interested. The energy your profile gives off matters more than any individual photo.');

  sectionDivider(doc);
  subheading(doc, 'The four things she reads instantly');
  bullet(doc, 'Main photo — is this someone she\'d be seen with? Does it project confidence without trying too hard?');
  bullet(doc, 'Bio energy — does it sound like every other guy, or does it make her curious?');
  bullet(doc, 'Activity signals — do your posts/stories suggest a life she\'d want access to?');
  bullet(doc, 'Consistency — does your whole profile tell one coherent story, or does it look like three different people?');

  doc.moveDown(.5);
  callout(doc, '"The goal of your profile is to make her think about what it would be like to talk to you — before you ever message her."');

  subheading(doc, 'What actually works');
  body(doc, 'One photo that shows your face clearly, in a context that implies something interesting is happening. Not a selfie. Not a group photo where she has to guess which one you are. Not a photo from three years ago.');
  body(doc, 'A bio that does one thing: makes her curious enough to accept a request or reply to a message. It doesn\'t need to be funny. It doesn\'t need to list your hobbies. It needs a single hook — something that makes her think "I wonder what he means by that."');

  sectionDivider(doc);
  subheading(doc, 'Platform-specific profile notes');
  bullet(doc, 'Snapchat — score and activity matter. A dead account with 200 score reads as inactive. Keep it warm.');
  bullet(doc, 'Instagram — story highlights are viewed before your grid. Make sure they\'re doing work.');
  bullet(doc, 'Tinder/Hinge — your first photo is 80% of the decision. The bio closes the remaining 20%.');
  bullet(doc, 'Twitter/X — your pinned tweet and header are your profile. Make them interesting, not promotional.');

  // ── Chapter 2: Opening Vault ──
  chapterCover(doc, 2, 'Opening\nVault.', 'First messages that actually get replies.');

  contentPage(doc);
  kicker(doc, 'Chapter 02 — Opening Vault');
  heading(doc, 'The first message sets everything.');
  body(doc, 'A bad opener doesn\'t just fail to get a reply — it sets a tone. It tells her what kind of conversation this is going to be. Generic, boring, one of a hundred she got today. The right opener does the opposite. It makes her stop, read it twice, and want to respond.');
  body(doc, 'Here\'s what most guys don\'t get: she\'s not ignoring you because she\'s not interested. She\'s ignoring you because you gave her nothing to work with. "Hey" is not a conversation starter. It\'s a test she\'s already failed you on.');

  sectionDivider(doc);
  subheading(doc, 'The opener framework');
  body(doc, 'A good opener does one of three things: it references something specific about her (not generic), it says something unexpected (makes her curious), or it implies a story she wants to know the end of. The best openers do more than one.');

  callout(doc, '"Don\'t ask a question she\'s been asked a hundred times. Say something she hasn\'t heard before and make her do the asking."');

  subheading(doc, 'Openers that work — with notes on why');
  bullet(doc, '"your profile is doing a lot of work for you" — implies something, doesn\'t give it away. She has to ask what you mean.');
  bullet(doc, '"you looked way too comfortable in that last photo" — specific, slightly playful, implies you were paying attention.');
  bullet(doc, '"ok genuine question" — no question needed. The setup makes her wait for it. Works in stories especially.');
  bullet(doc, '"you give off [specific vibe] energy" — specific enough to feel real, vague enough to be curious. Fill in something real.');
  bullet(doc, '"this one\'s different from the others" — reference to her content without specifying. She\'ll ask which one.');

  sectionDivider(doc);
  subheading(doc, 'What kills openers immediately');
  bullet(doc, 'Complimenting her looks in the first message — she gets this constantly. You become noise.');
  bullet(doc, 'Asking generic questions — "what are you up to?" is the death of tension.');
  bullet(doc, 'Over-explaining or being too eager — one line, max two. Leave space.');
  bullet(doc, 'Waiting too long after matching — reply within the first hour or the window shrinks.');

  body(doc, 'The goal of the opener is not to start a conversation. The goal is to get her to send the next message. Those are different things. Design your opener around that.');

  pageFooter(doc, 'WinOnAny Starter');

  doc.end();
  return new Promise((res) => out.on('finish', () => { console.log('[pdf] starter done'); res(); }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF 2 — THE VAULT ($97) — includes Starter content + more
// ═══════════════════════════════════════════════════════════════════════════════

function buildVault() {
  const doc = new PDFDocument({ size: 'A4', margins: { top:56, left:56, right:56, bottom:56 }, autoFirstPage: true });
  const out = fs.createWriteStream(path.join(OUT_DIR, 'winonany-vault.pdf'));
  doc.pipe(out);

  coverPage(doc, 'The Vault', 'Platform playbooks, escalation strategies, conversation frameworks, and situation-specific guides for every stuck moment.', C.accentLift);

  // ── Chapter 1: Conversation Game ──
  chapterCover(doc, 1, 'Conversation\nGame.', 'The situations every guy gets stuck in — and exactly what to do.');

  contentPage(doc);
  kicker(doc, 'Chapter 01 — Conversation Game');
  heading(doc, 'She\'s interested. She\'s not moving.');
  body(doc, 'This is the most common situation and the one most guys handle worst. The signs are there — she\'s replying, she\'s engaging, the energy is good — but nothing is progressing. She\'s comfortable in the conversation but she\'s not going anywhere. This isn\'t rejection. It\'s friction.');
  body(doc, 'The mistake most guys make here is doing more of the same thing that got them to this point. More messages, more conversation, more rapport-building. That\'s not what breaks friction. What breaks friction is changing the frame.');

  sectionDivider(doc);
  subheading(doc, 'The stuck conversation — what\'s actually happening');
  body(doc, 'When a conversation is stalled, it\'s usually one of three things: she\'s comfortable but not curious, the energy has gone flat, or she\'s waiting for you to make a move and you haven\'t. In any of these cases, the fix is the same: introduce tension.');
  callout(doc, '"Comfort is not attraction. She can be completely comfortable talking to you and still not go anywhere. Tension is what moves things."');

  subheading(doc, 'Breaking the stall — three moves');
  bullet(doc, 'The reframe: change what the conversation is about. If you\'ve been talking about her day, stop. Say something unexpected about her or about the situation that shifts the energy.');
  bullet(doc, 'The pull back: send less. Respond slower. Create a gap. She fills gaps. When you\'re always available, there\'s nothing to fill.');
  bullet(doc, 'The direct move: sometimes the cleanest thing is to be direct about the direction. Not desperate, not heavy — just clear. "you\'re clearly not boring, we should actually talk sometime." See what she does with it.');

  sectionDivider(doc);
  subheading(doc, 'She opened it but didn\'t reply');
  body(doc, 'Opened and ignored is different from not seen. She looked at it. Something stopped her from responding. This means your last message either asked too much, gave her nothing to reply to, or hit at a bad moment.');
  bullet(doc, 'Wait. Don\'t double message within an hour. Ever.');
  bullet(doc, 'When you do follow up, don\'t acknowledge the non-reply. Send something new. Something lower stakes than whatever you sent before.');
  bullet(doc, 'Use a question only if you haven\'t asked one in the last three messages. If you\'ve been asking questions, stop. Make a statement instead.');

  contentPage(doc);
  kicker(doc, 'Chapter 01 continued — Conversation Game');
  subheading(doc, 'She went cold after things were going good');
  body(doc, 'This one stings because you can see the moment it changed. Things were moving, the energy was there, then something shifted and she pulled back. Nine times out of ten this is not permanent. It\'s a reset.');
  callout(doc, '"Going cold doesn\'t mean she lost interest. It often means something outside the conversation changed her availability — not her interest."');
  bullet(doc, 'Wait at least 48 hours before reaching back out. Contacting too soon confirms her absence was right.');
  bullet(doc, 'Come back with something that doesn\'t reference the gap. No "hey stranger." No guilt. Just pick up like you\'ve been doing something interesting in the meantime.');
  bullet(doc, 'Keep it short. One message, no question. Make it feel like you ran into her, not like you\'ve been waiting.');

  subheading(doc, 'She keeps redirecting to talking instead');
  body(doc, 'She wants to call. She wants to "actually hang out." She keeps steering away from where you\'re trying to take the conversation. This is actually a good sign — she\'s engaged enough to suggest an alternative. But it\'s also friction you need to manage.');
  body(doc, 'Don\'t dismiss the alternative entirely — that reads as agenda-driven and makes her uncomfortable. Instead, play with it. "maybe after" works. "you first" works. Keep the frame playful and let the conversation find its own level.');

  // ── Chapter 2: Momentum Control ──
  chapterCover(doc, 2, 'Momentum\nControl.', 'Reading signals. Knowing when to move. What to do after.');

  contentPage(doc);
  kicker(doc, 'Chapter 02 — Momentum Control');
  heading(doc, 'Reading when she\'s ready.');
  body(doc, 'This is the skill that separates guys who consistently get what they want from guys who are always guessing. It\'s not magic. It\'s pattern recognition. And once you see it, you can\'t unsee it.');
  body(doc, 'Readiness signals aren\'t loud. She\'s not going to tell you directly. They show up in how she responds, how fast she responds, what she initiates, and what she reciprocates.');

  sectionDivider(doc);
  subheading(doc, 'Green signals — she\'s there');
  bullet(doc, 'She\'s initiating — sending first, bringing up topics, asking you questions without you asking her.');
  bullet(doc, 'She\'s matching your energy or going slightly beyond it.');
  bullet(doc, 'She\'s being playful or slightly challenging — testing to see how you respond.');
  bullet(doc, 'She sends something that has no informational value — just for the sake of the conversation.');
  bullet(doc, 'Her replies are getting longer or more detailed over time.');

  subheading(doc, 'Amber signals — she\'s interested but not there yet');
  bullet(doc, 'Replies are consistent but short. She\'s engaged but guarded.');
  bullet(doc, 'She\'s answering your questions but not asking her own.');
  bullet(doc, 'The energy is friendly but flat — no tension.');
  body(doc, 'Amber means slow down and build more. Don\'t push. Don\'t back off either. Stay in the conversation and create more curiosity.');

  subheading(doc, 'Stop signals — not now');
  bullet(doc, 'One word replies with no follow-up.');
  bullet(doc, 'Long gaps that she doesn\'t acknowledge.');
  bullet(doc, 'Topic changes when you introduce tension.');
  body(doc, 'Stop signals mean regroup. Not give up — regroup. Back off the direction, go back to neutral, and re-enter when the signals change.');

  sectionDivider(doc);
  subheading(doc, 'How to ask without killing it');
  callout(doc, '"The ask isn\'t a transaction. It\'s a natural next step in a conversation that\'s already going somewhere. If it feels like a big moment, you haven\'t built enough tension yet."');
  body(doc, 'The ask works best when it\'s low-pressure and slightly indirect. Not "send me something" — that\'s pressure, and pressure kills it. The best asks feel like an inevitable next step in a conversation that was already going there.');
  bullet(doc, 'Build enough context that the ask makes sense — it shouldn\'t come out of nowhere.');
  bullet(doc, 'Frame it as something mutual, not a demand. "I\'m curious what you actually look like right now" lands differently than "send me a pic."');
  bullet(doc, 'Keep the energy light. If she says not yet or deflects, don\'t push. Acknowledge it and keep talking. The window comes back.');

  subheading(doc, 'What to do right after she sends');
  body(doc, 'This is where most guys lose momentum they just earned. The wrong response here can reset everything you built. The right response locks in the dynamic and opens the next window.');
  bullet(doc, 'Respond, don\'t react. Calm beats excited every time. Excited reads as inexperienced.');
  bullet(doc, 'Acknowledge what she sent — briefly, specifically. Not a wall of compliments. One line.');
  bullet(doc, 'Keep the conversation going. Don\'t make it weird by going silent or making a big deal of it.');
  bullet(doc, 'The next ask, if there is one, should come naturally — not immediately. Let the moment breathe.');

  // ── Chapter 3: Platform Playbooks ──
  chapterCover(doc, 3, 'Platform\nPlaybooks.', 'Same situation, different surface. How each app works.');

  contentPage(doc);
  kicker(doc, 'Chapter 03 — Platform Playbooks');
  heading(doc, 'Every platform has a different pace.');
  body(doc, 'The mechanics don\'t change — signals are signals, tension is tension. But each platform has its own pace, its own norms, and its own path from opener to win. Knowing the platform is knowing the terrain.');

  sectionDivider(doc);
  subheading(doc, 'Snapchat');
  body(doc, 'Snap runs on streaks and stories. The best entry point is her story — it gives you a reason to message that doesn\'t feel cold. Story replies that work are specific, slightly unexpected, and don\'t need a question to get a response.');
  bullet(doc, 'The snap format is informal — match that energy. Short, punchy, lowercase.');
  bullet(doc, 'Build consistency before trying to move anything. A few days of back and forth first.');
  bullet(doc, 'Snap is the most natural platform for escalation because of the ephemeral format — things feel lower stakes.');

  subheading(doc, 'Instagram');
  body(doc, 'IG is visual. Her stories are an open door. The move from story reply to DM conversation is the first step. The move from DM to private is the second. Both require the same thing: enough conversation history that the transition feels natural.');
  bullet(doc, 'Story replies should be one or two sentences max. Not an essay.');
  bullet(doc, 'If she responds to your story reply in a DM, you\'re in. Now run the conversation like any other.');
  bullet(doc, 'IG rewards consistency — show up on her timeline, engage with her content, let her see you existing before you message.');

  subheading(doc, 'Tinder & Hinge');
  body(doc, 'The window on these apps is short. She matched and forgot. Your opener has to make her remember why. On Hinge, her prompts give you ammunition — use them. On Tinder, you\'re starting from zero.');
  bullet(doc, 'Tinder: one strong, specific opener. Don\'t ask how her day was. Ever.');
  bullet(doc, 'Hinge: reference a prompt but don\'t just answer it. Say something that makes her curious about you.');
  bullet(doc, 'Get off the app fast. Move to number or Snap within the first few exchanges. Staying on the app too long kills momentum.');

  subheading(doc, 'Twitter / X');
  body(doc, 'X is public before it\'s private. Engagement in public (likes, replies to her tweets) is visible and builds familiarity before you ever slide into DMs. The cold DM works here if you have something real to say.');
  bullet(doc, 'Reply to her tweets first. Public engagement builds a signal before private contact.');
  bullet(doc, 'DMs on X feel more intentional than on other apps — use that. Don\'t waste it on "hey."');
  bullet(doc, 'The move from X to another platform (Snap, IG, number) is the goal. Don\'t try to do everything on X.');

  pageFooter(doc, 'WinOnAny — The Vault');
  doc.end();
  return new Promise((res) => out.on('finish', () => { console.log('[pdf] vault done'); res(); }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF 3 — FULL ACCESS ($197) — advanced methods + all of the above
// ═══════════════════════════════════════════════════════════════════════════════

function buildFullAccess() {
  const doc = new PDFDocument({ size: 'A4', margins: { top:56, left:56, right:56, bottom:56 }, autoFirstPage: true });
  const out = fs.createWriteStream(path.join(OUT_DIR, 'winonany-fullaccess.pdf'));
  doc.pipe(out);

  coverPage(doc, 'Full Access', 'Advanced methods, real thread breakdowns, and situation-specific guides for every scenario. The complete playbook.', C.gold);

  // ── Chapter 1: Advanced Situation Guides ──
  chapterCover(doc, 1, 'Advanced\nSituations.', 'The scenarios most guys never figure out.');

  contentPage(doc);
  kicker(doc, 'Chapter 01 — Advanced Situations');
  heading(doc, 'She\'s Interested But Won\'t Send.');
  body(doc, 'This is the most requested situation. She\'s into you — the signals are there, the conversations are good, the energy is clearly not platonic — but when it gets to that point, she stops. She deflects, redirects, or just doesn\'t go there. This is not rejection. This is a comfort gap.');
  body(doc, 'The comfort gap exists when her interest level is high but her comfort with the specific ask or the specific direction isn\'t there yet. Closing the gap means building enough context and enough trust that going there feels like the natural next step, not a risk she\'s taking.');

  sectionDivider(doc);
  subheading(doc, 'Why she\'s not sending — the real reasons');
  bullet(doc, 'She doesn\'t feel like she knows you well enough yet — even if she\'s attracted. Time and consistency fix this.');
  bullet(doc, 'The ask came before enough tension was built — it felt abrupt, so she backed off.');
  bullet(doc, 'She has a policy (or tells herself she does) — this dissolves with the right framing over time.');
  bullet(doc, 'She\'s done it before and it ended badly — reassurance comes from consistency, not promises.');
  bullet(doc, 'She\'s waiting for you to be more explicit about what you want — some girls won\'t go first without a clear signal.');

  subheading(doc, 'The playbook for this situation');
  body(doc, 'Don\'t push. Don\'t withdraw either. Stay in the conversation and change the approach. The conversation that got you to this point isn\'t going to be the one that closes the gap — you need to add something.');
  callout(doc, '"The gap closes when she feels like going there is her idea as much as yours. Your job is to make that possible."');
  bullet(doc, 'Introduce a bit of vulnerability on your end — not oversharing, just something real. It lowers her guard.');
  bullet(doc, 'Be clearer about what you want, without making it a demand. Clarity removes ambiguity that often holds people back.');
  bullet(doc, 'Give it time and consistency. Show up reliably without pressure. The window opens when she trusts the situation.');
  bullet(doc, 'When she does eventually go there, your response in that moment matters more than anything before it. Calm, appreciative, not over-the-top. Keep it moving.');

  sectionDivider(doc);
  heading(doc, 'She Sends to Other Guys But Not You.');
  body(doc, 'You know this is happening. Maybe she\'s said something, maybe you\'ve picked it up another way. Either way, the question is the same: why them and not you? The answer is usually one of two things: perceived value difference or comfort level difference.');
  body(doc, 'Value difference means she\'s categorized you differently — as a friend, as someone she talks to, not as someone she goes there with. Comfort difference means the relationship with the other guys has a history or a context that yours doesn\'t have yet.');
  bullet(doc, 'Figure out which one it is before you try to fix it. The fixes are different.');
  bullet(doc, 'Value gap: change how you\'re showing up in the conversation. Be less available. Introduce more tension. Stop behaving like a friend.');
  bullet(doc, 'Comfort gap: build more history. More conversations. More consistency. More real moments. The comfort comes with time.');

  // ── Chapter 2: Real Thread Breakdowns ──
  chapterCover(doc, 2, 'Real Thread\nBreakdowns.', 'Actual conversations annotated — what worked, what didn\'t, and why.');

  contentPage(doc);
  kicker(doc, 'Chapter 02 — Real Thread Breakdowns');
  heading(doc, 'How to read a conversation like a map.');
  body(doc, 'The fastest way to get better at this is to study conversations that worked and understand why each move worked. Not just the lines — the timing, the energy, the spaces between messages, what wasn\'t said as much as what was.');
  body(doc, 'The following breakdowns are real conversation patterns with annotations. Names and identifying details are removed. The structure is real.');

  sectionDivider(doc);
  subheading(doc, 'Thread 01 — Cold open to win (Snapchat)');
  callout(doc, 'HIM: "you looked way too comfortable in that last photo"\nHER: "comfortable how"\nHIM: "like you knew exactly what you were doing"\n[typing indicator... 90 seconds]\nHER: "maybe i did"\nHIM: "then you\'ll like where this is going"');

  body(doc, '↑ What\'s happening here: The opener is specific without being a compliment. It implies she did something intentional — which makes her want to defend or explain it. Her reply ("comfortable how") is her asking him to continue, which he does without giving too much. The pause before "maybe i did" is her deciding to engage. His final line is confident and open-ended — it promises something without specifying what. She now has to ask or lean in. That\'s the win.');

  sectionDivider(doc);
  subheading(doc, 'Thread 02 — Stalled conversation revived (Instagram)');
  callout(doc, '[3 days of no contact]\nHIM: "saw something today that was completely your energy"\nHER: "what was it"\nHIM: "tell you when you\'re less mysterious"\nHER: "lol I\'m not mysterious"\nHIM: "your last three posts say otherwise"');

  body(doc, '↑ What\'s happening here: He didn\'t acknowledge the gap. He didn\'t apologize for going quiet or make her feel guilty for going quiet. He came back with something interesting and low-stakes that required her to engage. "Tell you when you\'re less mysterious" is a reversal — she expected an answer and he made it conditional on her. That\'s tension. She pushes back lightly, he holds his frame. Three messages to re-establish the dynamic.');

  sectionDivider(doc);
  subheading(doc, 'Thread 03 — Handling the deflection');
  callout(doc, 'HIM: [makes a move]\nHER: "lol I don\'t really do that"\nHIM: "noted. what do you do"\nHER: "haha depends"\nHIM: "on"\nHER: "who\'s asking I guess"');

  body(doc, '↑ What\'s happening here: She deflects. He doesn\'t react, doesn\'t apologize, doesn\'t make it a moment. He pivots with "what do you do" — which keeps the frame without acknowledging the rejection. Her "depends" is an open door. His single word response "on" forces her to elaborate. Her final message is her putting the ball back in his court — which means she\'s still in it. The deflection was not a no.');

  // ── Chapter 3: The Dry Texter Fix ──
  chapterCover(doc, 3, 'Advanced\nFrameworks.', 'The dry texter fix, re-engagement after going cold, and the long game.');

  contentPage(doc);
  kicker(doc, 'Chapter 03 — Advanced Frameworks');
  heading(doc, 'The Dry Texter Fix.');
  body(doc, 'She replies in one word. "lol." "yeah." "haha." She\'s not hostile — she\'s just giving you nothing. Most guys keep asking questions, keep trying to generate conversation, and slowly exhaust themselves. That\'s the wrong move.');
  body(doc, 'Dry texters are not uninterested by default. They\'re either not phone people, not comfortable enough yet, or they\'re testing to see how you handle low-effort replies. The fix is to stop generating conversation and start creating curiosity.');

  sectionDivider(doc);
  subheading(doc, 'The dry texter playbook');
  bullet(doc, 'Stop asking questions. Questions put the burden on her. She\'s already shown she\'s not going to carry that burden right now.');
  bullet(doc, 'Send statements that don\'t require a response but make her want to reply anyway. "just saw something that made me think of your vibe" — she\'s going to ask what it was.');
  bullet(doc, 'Match her energy, then drop below it. If she\'s giving one word, give her one word back. Silence is a conversation move.');
  bullet(doc, 'Send less overall. The gap creates pressure she fills.');
  callout(doc, '"A dry texter who suddenly sends three messages in a row is telling you something. Pay attention to what changed in the conversation before that happened."');

  sectionDivider(doc);
  heading(doc, 'The Long Game.');
  body(doc, 'Some conversations don\'t move in a week. Some don\'t move in a month. This doesn\'t mean they won\'t move. The long game is about staying present without being needy — existing in her orbit without making it weird.');
  bullet(doc, 'Consistency without pressure. Show up in small ways. Engage with her content. Send something when it\'s genuinely relevant.');
  bullet(doc, 'Don\'t make her feel like she owes you anything. That kills it faster than anything.');
  bullet(doc, 'Give her space to miss you. If you\'re always there, there\'s nothing to miss.');
  bullet(doc, 'When she comes back — and she will, if the dynamic is right — pick up like no time passed. Don\'t make her explain the gap.');
  body(doc, 'The long game is won by being the most interesting constant in her orbit. Not the most persistent. Not the most available. The most interesting.');

  pageFooter(doc, 'WinOnAny — Full Access');
  doc.end();
  return new Promise((res) => out.on('finish', () => { console.log('[pdf] full access done'); res(); }));
}

// ── Run all three ─────────────────────────────────────────────────────────────
(async function() {
  console.log('[pdf] generating all three PDFs...');
  await buildStarter();
  await buildVault();
  await buildFullAccess();
  console.log('[pdf] all done → /pdfs/');
})().catch((err) => {
  console.error('[pdf] error:', err.message);
  process.exit(1);
});
