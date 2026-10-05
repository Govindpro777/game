/**
 * Conversations with Faye at the seed shop door.
 *
 * A script is a graph of nodes rather than a flat list, because the return visit
 * branches on what the player answers. Every node either points at the `next` one,
 * offers `choices`, or `end`s the conversation with an outcome the caller acts on
 * ('enter' opens the shop, 'leave' leaves the player outside).
 */

export type Speaker = 'faye' | 'bao' | 'ted' | 'guru'
export type DialogueEnd = 'enter' | 'leave'

export type Choice = {
  label: string
  /** Where this answer leads; exactly one of the two is set. */
  to?: string
  end?: DialogueEnd
}

export type DialogueNode = {
  /** Omitted for narration, which is shown centred with no portrait or name plate. */
  who?: Speaker
  text: string
  next?: string
  choices?: Choice[]
  /** Terminal line: the conversation ends with this outcome once it is dismissed. */
  end?: DialogueEnd
  /** Recorded (in a Set handed to the caller's onEnd) if this node is ever reached --
   * lets main.ts react to which branch was taken without the script touching state. */
  flag?: string
}

export type DialogueScript = Record<string, DialogueNode>

export const SPEAKERS: Record<Speaker, { name: string; role?: string; portrait: string }> = {
  faye: { name: 'Faye', role: 'Seed Shop Owner', portrait: '/portrait/faye.png' },
  bao: { name: 'Bao', portrait: '/portrait/bao.png' },
  ted: { name: 'Ted', role: 'Tool Shop Owner', portrait: '/portrait/ted.png' },
  guru: { name: 'Guru', role: 'Farm Owner', portrait: '/portrait/guru.png' },
}

/** Played once, the first time the player ever walks up to the seed shop. */
export const FIRST_VISIT: DialogueScript = {
  start: {
    who: 'faye',
    text: 'Hi! You must be new around town. I’m Faye, and I run the seed store.',
    next: 'bao_intro',
  },
  bao_intro: {
    who: 'bao',
    text: 'Yeah, I’m Bao. I just got here. I’m planning to become a farmer.',
    next: 'faye_farmer',
  },
  faye_farmer: {
    who: 'faye',
    text: 'A farmer, huh? Then you’ll definitely need some seeds to get started.',
    next: 'bao_tools',
  },
  bao_tools: {
    who: 'bao',
    text: 'Of course. But… do you know where I can get the tools I’ll need?',
    next: 'faye_ted',
  },
  faye_ted: {
    who: 'faye',
    text: 'Hmm… have you met Ted yet?',
    next: 'bao_who',
  },
  bao_who: {
    who: 'bao',
    text: 'Ted? Who’s Ted?',
    next: 'faye_explore',
  },
  faye_explore: {
    who: 'faye',
    text: 'Ted owns the oldest and most trusted tool shop in town. Go explore the town and you’ll find him. Who knows what else you might discover along the way?',
    next: 'bao_thanks',
  },
  bao_thanks: {
    who: 'bao',
    text: 'Sounds interesting. Thanks a lot, Faye!',
    next: 'faye_offer',
  },
  faye_offer: {
    who: 'faye',
    text: 'Before you go… want to grab some seeds? You’ll need them if you want to grow your farm.',
    next: 'bao_sure',
  },
  bao_sure: {
    who: 'bao',
    text: 'Sure. Why not?',
    next: 'faye_good',
  },
  faye_good: {
    who: 'faye',
    text: 'Good choice. Every great farm starts with a single seed.',
    next: 'bao_step',
  },
  bao_step: {
    who: 'bao',
    text: 'Then I guess I’ve got my first step.',
    end: 'enter',
  },
}

/** Every visit after the first. Branches on whether Bao has met Ted and wants seeds. */
export const RETURN_VISIT: DialogueScript = {
  start: {
    who: 'faye',
    text: 'Hi Bao! Did you meet Ted?',
    choices: [
      { label: 'Yes', to: 'met_ted' },
      { label: 'No', to: 'not_met_ted' },
    ],
  },
  met_ted: {
    who: 'faye',
    text: 'Awesome. He’s got some great tools. Need seeds today?',
    // The second time Bao confirms this, the "did you meet Ted?" script retires
    // for good in favour of RETURN_VISIT_STEADY -- see talkToFaye() in main.ts.
    flag: 'metTedYes',
    choices: [
      { label: 'Yes', to: 'seeds_yes' },
      { label: 'No', to: 'seeds_no' },
    ],
  },
  not_met_ted: {
    who: 'faye',
    text: 'You must meet him, he has great tools. You aren’t still using that old shovel Guru gave you? Need any seeds today?',
    choices: [
      { label: 'Yes', to: 'seeds_yes' },
      { label: 'No', to: 'seeds_no' },
    ],
  },
  seeds_yes: {
    who: 'faye',
    text: 'Wonderful — come on in and take a look at what’s in stock.',
    end: 'enter',
  },
  seeds_no: {
    who: 'faye',
    text: 'Ok, stop by when you do. I’m open 9am - 6pm.',
    next: 'walks_in',
  },
  walks_in: {
    text: 'Faye walks inside the store. Bao walks to the door.',
    next: 'door',
  },
  door: {
    text: 'Enter the Seed Store?',
    choices: [
      { label: 'Yes', end: 'enter' },
      { label: 'No', end: 'leave' },
    ],
  },
}

/**
 * The steady-state script: once Bao has confirmed meeting Ted twice, the "have you
 * met Ted?" onboarding question retires and every visit after uses this instead.
 */
export const RETURN_VISIT_STEADY: DialogueScript = {
  start: {
    who: 'faye',
    text: 'Hey Bao! Back already? How’s your farm coming along?',
    next: 'bao_going_well',
  },
  bao_going_well: {
    who: 'bao',
    text: 'It’s going well! I’m just getting started.',
    next: 'faye_bigger',
  },
  faye_bigger: {
    who: 'faye',
    text: 'That’s good to hear. Are you planning to grow your farm even bigger?',
    next: 'bao_definitely',
  },
  bao_definitely: {
    who: 'bao',
    text: 'Yes, definitely!',
    next: 'faye_more_seeds',
  },
  faye_more_seeds: {
    who: 'faye',
    text: 'Then you’ll need more seeds. Want to pick up some today?',
    choices: [
      { label: 'Yes', to: 'seeds_yes' },
      { label: 'No', to: 'seeds_no' },
    ],
  },
  seeds_yes: {
    who: 'faye',
    text: 'Great! Let’s see what you’d like to grow next.',
    end: 'enter',
  },
  seeds_no: {
    who: 'faye',
    text: 'No worries. Come back whenever you’re ready. Your farm isn’t going to grow overnight!',
    next: 'walks_in',
  },
  walks_in: {
    text: 'Faye walks inside the store. Bao walks to the door.',
    next: 'door',
  },
  door: {
    text: 'Enter the Seed Store?',
    choices: [
      { label: 'Yes', end: 'enter' },
      { label: 'No', end: 'leave' },
    ],
  },
}

/**
 * Conversation with Ted outside the tool shop. Unlike every other conversation in
 * the game, this one is shown in the small plain "corner" narration box (see the
 * `corner` option on openDialogue() in dialogue.ts) rather than the portrait +
 * name-plate box -- so no node here sets `who`; speakers are written directly
 * into the line instead, the way a visual-novel narration box does it.
 */

/** Played once, the first time the player ever walks up to the tool shop. */
export const TOOL_FIRST_VISIT: DialogueScript = {
  start: {
    text: 'Bao (thinking): Ok, Guru said I need tools. The shovel he gave me looks like it will fall apart in less than a minute…',
    next: 'arrive',
  },
  arrive: {
    text: 'Bao: What’s this place? Ted’s… Ted’s Tools! Ok, here it is.',
    next: 'prompt',
  },
  prompt: {
    text: 'Enter Ted’s Tools?',
    choices: [
      { label: 'Yes', end: 'enter' },
      { label: 'No', to: 'confirm' },
    ],
  },
  confirm: {
    text: 'You sure? That shovel Guru gave you wouldn’t cut through butter.',
    choices: [
      { label: 'Yes', end: 'enter' },
      { label: 'No', to: 'decline' },
    ],
  },
  decline: {
    text: 'Ok, Bao. He’s open tomorrow.',
    next: 'explore',
  },
  explore: {
    text: 'Bao started to explore the town.',
    end: 'leave',
  },
}

/** Every visit after the first: skips Bao's backstory, keeps the same prompt. */
export const TOOL_RETURN_VISIT: DialogueScript = {
  start: {
    text: 'Enter Ted’s Tools?',
    choices: [
      { label: 'Yes', end: 'enter' },
      { label: 'No', to: 'confirm' },
    ],
  },
  confirm: {
    text: 'You sure? That shovel Guru gave you wouldn’t cut through butter.',
    choices: [
      { label: 'Yes', end: 'enter' },
      { label: 'No', to: 'decline' },
    ],
  },
  decline: {
    text: 'Ok, Bao. He’s open tomorrow.',
    next: 'explore',
  },
  explore: {
    text: 'Bao continues to explore the town.',
    end: 'leave',
  },
}

/**
 * Conversation with Guru, the farm owner, at the gate of his farm. Normal portrait
 * dialogue (Guru's and Bao's portraits), with narration lines -- no `who` -- for the
 * stage directions. Finishing it walks the player on into the farm itself.
 */

/** Played once, the first time the player ever walks up to Guru. */
export const FARM_FIRST_VISIT: DialogueScript = {
  start: {
    who: 'guru',
    text: 'At Greenville, we pride ourselves on quality, fresh and organic produce.',
    next: 'bao_good',
  },
  bao_good: { who: 'bao', text: 'Good to know.', next: 'plot' },
  plot: {
    who: 'guru',
    text: 'As an introduction to farming, I am giving this plot to you. These tomatoes are ready to harvest. Take my shovel.',
    next: 'shovel',
  },
  shovel: {
    text: 'Guru hands Bao an old shovel that has seen better days.',
    next: 'used',
  },
  used: { who: 'bao', text: 'It looks a bit, shall we say, used…', next: 'harvest_seen' },
  harvest_seen: { who: 'guru', text: 'It’s seen many a harvest.', next: 'breaks' },
  breaks: {
    text: 'Bao harvests the tomatoes and digs up the empty plants. His shovel breaks.',
    next: 'gentle',
  },
  gentle: {
    who: 'guru',
    text: 'A gentle touch was needed there, but you’re new, so I understand. I have a friend, Ted, he owns the tool shop.',
    next: 'sneeze',
  },
  sneeze: {
    who: 'bao',
    text: 'Gentle touch? This thing would have fallen apart if I sneezed on it.',
    next: 'nam',
  },
  nam: {
    who: 'guru',
    text: 'What was that? I couldn’t hear you. I got shrapnel in the ear back in ’nam. Docs say I can only hear what I want to hear.',
    next: 'allergies',
  },
  allergies: { who: 'bao', text: 'Oh I just said I sneezed. I got allergies.', next: 'faye' },
  faye: {
    who: 'guru',
    text: 'You’re a country boy now, you will get used to it. Ok, last thing from me for now. Take the tomatoes to Faye. She owns the seed store, and she sells produce. She will give you some money for that little lot. Go find Ted, replace that shovel you broke and go be a farmer!',
    end: 'enter',
  },
}

/** Every visit after the first: no backstory, just offers to head onto the farm. */
export const FARM_RETURN_VISIT: DialogueScript = {
  start: {
    who: 'guru',
    text: 'Back already? Your plot is waiting for you, farmer.',
    next: 'prompt',
  },
  prompt: {
    text: 'Head onto the farm?',
    choices: [
      { label: 'Yes', end: 'enter' },
      { label: 'No', to: 'decline' },
    ],
  },
  decline: {
    who: 'guru',
    text: 'Suit yourself. The crops will keep.',
    end: 'leave',
  },
}
