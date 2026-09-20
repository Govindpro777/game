/**
 * Conversations with Faye at the seed shop door.
 *
 * A script is a graph of nodes rather than a flat list, because the return visit
 * branches on what the player answers. Every node either points at the `next` one,
 * offers `choices`, or `end`s the conversation with an outcome the caller acts on
 * ('enter' opens the shop, 'leave' leaves the player outside).
 */

export type Speaker = 'faye' | 'bao'
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
}

export type DialogueScript = Record<string, DialogueNode>

export const SPEAKERS: Record<Speaker, { name: string; portrait: string }> = {
  faye: { name: 'Faye', portrait: '/portrait/faye.png' },
  bao: { name: 'Bao', portrait: '/portrait/bao.png' },
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
