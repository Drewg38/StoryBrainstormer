/**
 * Character Randomizer (9-Category Edition)
 * - Supports: archetype, positive_trait, fatal_flaw, motivation,
 *   backstory_catalyst, occupation, secret, external_conflict, internal_conflict
 * - Outputs a “rolled combo” object + your approved one-liner seed format.
 *
 * HOW TO USE
 * 1) Provide arrays for each category (label/description optional).
 * 2) Call rollCharacter({ categories, rng }) to generate a character.
 * 3) Optionally customize the one-liner template via formatOneLiner().
 */

/** @typedef {{ label: string, description?: string }} Entry */
/** @typedef {{ name: string, items: Entry[] }} Category */
/** @typedef {{
 *   archetype: Entry, positive_trait: Entry, fatal_flaw: Entry, motivation: Entry,
 *   backstory_catalyst: Entry, occupation: Entry, secret: Entry,
 *   external_conflict: Entry, internal_conflict: Entry
 * }} Roll */
/** @typedef {{
 *   random: () => number
 * }} RNG */

/* ----------------------------- RNG Utilities ----------------------------- */

function makeRNG(seed) {
  // Mulberry32 for deterministic rolls; falls back to Math.random if no seed.
  if (seed == null) return { random: Math.random };
  let s = (seed >>> 0) || 0x1a2b3c4d;
  return {
    random: () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };
}

function pick(rng, arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Cannot pick from empty array");
  }
  const i = Math.floor(rng.random() * arr.length);
  return arr[i];
}

/* ------------------------- One-Liner Seed Template ------------------------ */

/**
 * Default one-liner formatter (exact template you approved).
 * You can swap this for your own function if you want alternate wordings.
 * @param {Roll} roll
 * @returns {string}
 */
export function formatOneLiner(roll) {
  const a = roll;
  return (
    `A ${a.positive_trait.label.toLowerCase()} ${a.archetype.label.toLowerCase()}, ` +
    `${a.backstory_catalyst.label.toLowerCase()}, now ${a.occupation.label.toLowerCase()}; ` +
    `${a.fatal_flaw.label.toLowerCase()} collides with ${a.motivation.label.toLowerCase()}, ` +
    `while ${a.external_conflict.label.toLowerCase()} forces a choice between ` +
    `${a.internal_conflict.label.split(" vs. ").join(" (")} and ${a.internal_conflict.label.split(" vs. ").slice(-1)}).`
  );
}

/* --------------------------- Roll + Format API ---------------------------- */

/**
 * @param {{
 *   archetype: Entry[], positive_trait: Entry[], fatal_flaw: Entry[], motivation: Entry[],
 *   backstory_catalyst: Entry[], occupation: Entry[], secret: Entry[],
 *   external_conflict: Entry[], internal_conflict: Entry[]
 * }} categories
 * @param {{ seed?: number, rng?: RNG }} [opts]
 * @returns {Roll}
 */
export function rollCharacter(categories, opts = {}) {
  const rng = opts.rng || makeRNG(opts.seed);
  const r = {
    archetype: pick(rng, categories.archetype),
    positive_trait: pick(rng, categories.positive_trait),
    fatal_flaw: pick(rng, categories.fatal_flaw),
    motivation: pick(rng, categories.motivation),
    backstory_catalyst: pick(rng, categories.backstory_catalyst),
    occupation: pick(rng, categories.occupation),
    secret: pick(rng, categories.secret),
    external_conflict: pick(rng, categories.external_conflict),
    internal_conflict: pick(rng, categories.internal_conflict),
  };
  return r;
}

/**
 * Returns a display block matching your “Example (rolled combo)” format.
 * @param {Roll} roll
 * @returns {string}
 */
export function formatRolledComboBlock(roll) {
  const lines = [
    "Example (rolled combo)",
    "",
    `Archetype: ${roll.archetype.label}`,
    `Positive Trait: ${roll.positive_trait.label}`,
    `Fatal Flaw: ${roll.fatal_flaw.label}`,
    `Motivation: ${roll.motivation.label}`,
    `Backstory Catalyst: ${roll.backstory_catalyst.label}`,
    `Occupation: ${roll.occupation.label}`,
    `Secret: ${roll.secret.label}`,
    `External Conflict: ${roll.external_conflict.label}`,
    `Internal Conflict: ${roll.internal_conflict.label}`,
    "",
    "One-liner seed:",
    formatOneLiner(roll)
  ];
  return lines.join("\n");
}

/**
 * Convenience: packs a roll and its one-liner into a JSON-friendly object.
 * @param {Roll} roll
 */
export function toResultJSON(roll) {
  return {
    archetype: roll.archetype.label,
    positive_trait: roll.positive_trait.label,
    fatal_flaw: roll.fatal_flaw.label,
    motivation: roll.motivation.label,
    backstory_catalyst: roll.backstory_catalyst.label,
    occupation: roll.occupation.label,
    secret: roll.secret.label,
    external_conflict: roll.external_conflict.label,
    internal_conflict: roll.internal_conflict.label,
    one_liner_seed: formatOneLiner(roll)
  };
}

/* ----------------------------- Example wiring ----------------------------- */
/*
  You already maintain your lists as JSON files with objects:
  { "label": "Healer", "description": "..." }

  Load them however you like (Node: fs, Browser: fetch). Below is a simple
  example that expects category arrays injected from your app.

  Example usage:

  import {
    rollCharacter, formatRolledComboBlock, toResultJSON
  } from "./character_randomizer.js";

  // Suppose you’ve loaded arrays from your 9 JSONs:
  const categories = {
    archetype,
    positive_trait,
    fatal_flaw,
    motivation,
    backstory_catalyst,
    occupation,
    secret,
    external_conflict,
    internal_conflict,
  };

  const roll = rollCharacter(categories, { seed: 1337 });
  console.log(formatRolledComboBlock(roll));
  console.log(JSON.stringify(toResultJSON(roll), null, 2));
*/

/* ----------------------- Sanity demo with your example -------------------- */
/*
  // If you want to verify output against your approved example,
  // you can construct a roll manually and format it:

  const demoRoll = {
    archetype: { label: "Healer" },
    positive_trait: { label: "Resourceful" },
    fatal_flaw: { label: "Obsession" },
    motivation: { label: "Redemption" },
    backstory_catalyst: { label: "Exiled from a holy city after a botched miracle" },
    occupation: { label: "Smuggler-medic in a riverport" },
    secret: { label: "Staged miracle that launched a sect" },
    external_conflict: { label: "Religious inquisition tightening its net" },
    internal_conflict: { label: "Justice vs. Mercy" },
  };

  console.log(formatRolledComboBlock(demoRoll));
*/
