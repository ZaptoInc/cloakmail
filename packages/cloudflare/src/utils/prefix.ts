// Générateur de prefix aléatoire. Garder synchronisé avec
// packages/web/src/lib/utils/generateAddress.ts (mêmes listes, même format).

export const adjectives = [
  "fast", "swift", "vibrant", "silent", "shadow", "cosmic",
  "bold", "dark", "bright", "clever", "lucky", "noble",
  "wild", "calm", "steel", "iron", "neon", "crimson",
  "amber", "azure", "brave", "brisk", "chill", "cobalt",
  "cool", "crisp", "cyber", "daring", "dusty", "eager",
  "electric", "emerald", "epic", "fierce", "fiery", "frosty",
  "fuzzy", "gentle", "giant", "gilded", "glowing", "golden",
  "grand", "happy", "hidden", "hollow", "icy", "indigo",
  "jade", "jolly", "keen", "lunar", "magic", "mellow",
  "mighty", "misty", "mystic", "nimble", "nova", "onyx",
  "pixel", "polar", "proud", "quick", "quiet", "radiant",
  "rapid", "rogue", "royal", "ruby", "rusty", "sacred",
  "scarlet", "secret", "sharp", "shiny", "silver", "sleek",
  "sly", "smooth", "snowy", "solar", "sonic", "spicy",
  "stealth", "stellar", "stormy", "sunny", "super", "teal",
  "tiny", "turbo", "ultra", "velvet", "violet", "vivid",
  "wise", "witty", "zany", "zen"
];

export const nouns = [
  "tiger", "falcon", "wolf", "hawk", "phantom", "viper",
  "raven", "storm", "blaze", "frost", "cipher", "ghost",
  "knight", "spark", "ember", "orbit", "pulse", "nexus",
  "anchor", "arrow", "atlas", "badger", "bear", "bison",
  "bolt", "breeze", "canyon", "comet", "condor", "coral",
  "cougar", "coyote", "crane", "crow", "dagger", "delta",
  "dingo", "dragon", "drift", "eagle", "echo", "hornet",
  "fox", "galaxy", "gecko", "glacier", "griffin", "harbor",
  "heron", "horizon", "jaguar", "jet", "kestrel", "koala",
  "lagoon", "lantern", "lynx", "meteor", "mirage", "moon",
  "moose", "nebula", "ninja", "oasis", "ocean", "otter",
  "owl", "panda", "panther", "parrot", "pebble", "pilot",
  "pixel", "planet", "puma", "quasar", "rabbit", "reef",
  "rider", "river", "rocket", "sage", "shark", "sierra",
  "signal", "sparrow", "sphinx", "star", "summit", "thunder",
  "titan", "torch", "tundra", "vector", "voyager", "walrus",
  "willow", "wizard", "yeti", "zephyr"
];

/** Entier aléatoire uniforme dans [0, max), via le CSPRNG de Web Crypto. */
export function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  // Rejet des valeurs du dernier intervalle incomplet pour éviter le biais du modulo
  const limit = Math.floor(0x100000000 / max) * max;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

export function generateRandomPrefix(): string {
  const adj = adjectives[randomInt(adjectives.length)];
  const noun = nouns[randomInt(nouns.length)];
  const num = randomInt(10000);
  return `${adj}.${noun}${num}`;
}

/**
 * Partie locale acceptée pour une adresse : 1 à 64 caractères parmi
 * a-z, 0-9, `.`, `_`, `+`, `-`, sans commencer ni finir par un séparateur.
 */
const PREFIX_RE = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/;

export function isValidPrefix(prefix: string): boolean {
  return PREFIX_RE.test(prefix) && !prefix.includes("..");
}
