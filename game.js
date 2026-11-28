'use strict';

/* =====================================================================
   PET PALS — a pet raising game
   Sections: data · state & saving · pet drawing · care & leveling ·
             screens (room, shop, games, eggs, pets) · minigames · loop
   ===================================================================== */

/* ============================ DATA ============================ */

// Opening the game with ?sandbox uses a separate save, for trying things out without touching the real one.
// Each player has their own save (picked on the login screen, see login.js).
const SAVE_KEY = window.PETPALS_SAVE_KEY || (new URLSearchParams(location.search).has('sandbox') ? 'petpals-sandbox' : 'petpals-save-v2');
const MAX_EGGS = 3;
const STAGES = ['Baby', 'Teen', 'Adult'];
const EVOLVE_AT = [0, 100, 300];               // pet XP needed for each stage
// How fast each stat drops per second while awake (100 → 0 in roughly 35-65 minutes).
const RATES = { hunger: 0.04 / 9, thirst: 0.045 / 9, happiness: 0.035 / 9, energy: 0.025 / 9 };   // per second (made 9x slower than the start)
const SLEEP_ENERGY_GAIN = 0.8;                 // energy per second while sleeping
const GAME_ENERGY_COST = 12;

const STAT_INFO = [
  { key: 'hunger', icon: '🍗', label: 'Hunger' },
  { key: 'thirst', icon: '💧', label: 'Thirst' },
  { key: 'happiness', icon: '😊', label: 'Happiness' },
  { key: 'energy', icon: '⚡', label: 'Energy' },
];

const RARITY = {
  common:    { w: 63.1, xp: 25,  label: 'Common',    color: '#7a9a7a' },
  uncommon:  { w: 27,   xp: 35,  label: 'Uncommon',  color: '#3d8bd9' },
  rare:      { w: 9,    xp: 50,  label: 'Rare',      color: '#b05bd9' },
  legendary: { w: 0.8,  xp: 100, label: 'Legendary', color: '#e0a100' },
  divine:    { w: 0.1,  xp: 250, label: 'Divine',    color: 'linear-gradient(90deg,#ff6b9a,#ffb84d,#6cd47e,#4dc3ff,#b388ff)' },
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary', 'divine'];

const REGIONS = [
  { id: 'grass',  name: 'Grass Fields',  emoji: '🌿', level: 5,   cost: 100,   hatch: 30,  eggName: 'Mossy Crystal Egg', egg: '#d8f5c0', spot: '#5cbf5c' },
  { id: 'water',  name: 'Water Lagoon',  emoji: '🌊', level: 20,  cost: 400,   hatch: 60,  eggName: 'Tidepool Pearl Egg', egg: '#c9ecff', spot: '#3d8bd9' },
  { id: 'fire',   name: 'Fire Mountain', emoji: '🌋', level: 35,  cost: 800,   hatch: 90,  eggName: 'Magma Ember Egg', egg: '#ffb38a', spot: '#d63a1e' },
  { id: 'ice',    name: 'Ice Caves',     emoji: '❄️', level: 50,  cost: 1500,  hatch: 120, eggName: 'Glacier Frost Egg', egg: '#eef6ff', spot: '#7fb2ff' },
  { id: 'candy',  name: 'Candy Land',    emoji: '🍭', level: 70,  cost: 2500,  hatch: 180, eggName: 'Sugar Swirl Egg', egg: '#ffd6ec', spot: '#ff5fa8' },
  { id: 'spooky', name: 'Spooky Hollow', emoji: '👻', level: 80,  cost: 3500,  hatch: 240, eggName: 'Phantom Lantern Egg', egg: '#5a4a78', spot: '#ff9a3c' },
  { id: 'sky',    name: 'Sky Kingdom',   emoji: '☁️', level: 100, cost: 5000,  hatch: 300, eggName: 'Cloud Halo Egg', egg: '#f2f6ff', spot: '#ffd23f' },
  { id: 'cyber',  name: 'Cyber City',    emoji: '🤖', level: 125, cost: 7500,  hatch: 360, eggName: 'Neon Circuit Egg', egg: '#34405a', spot: '#3ff0ff' },
  { id: 'galaxy', name: 'Galaxy',        emoji: '🌌', level: 155, cost: 10000, hatch: 480, eggName: 'Nebula Starlight Egg', egg: '#262b6b', spot: '#ffe27a' },
];

// Every region's egg has 15 pets: 5 Common, 4 Uncommon, 3 Rare, 2 Legendary, 1 Divine.
// Each pet is a real animal dressed in its region's theme.
// [id, name, rarity, animal, body colour, belly colour, accent colour, extras]
const SPECIES = {};
function addSpecies(region, list) {
  for (const [id, name, rarity, animal, body, belly, accent, extra] of list) {
    SPECIES[id] = { name, region, rarity, animal, body, belly, accent, ...(extra || {}) };
  }
}
const C = 'common', U = 'uncommon', R = 'rare', L = 'legendary', D = 'divine';

addSpecies('grass', [
  ['sprout', 'Leaf Bunny', C, 'bunny', '#a8e6a1', '#f0fbe9', '#6cc46c'],
  ['puff', 'Jackalope', C, 'bunny', '#d8b88a', '#f8ecd8', '#8b5a2b', { antlers: true }],
  ['nutty', 'Acorn Bear', C, 'bear', '#c98d5a', '#f5e1c8', '#8b5a2b'],
  ['bumble', 'Meadow Chick', C, 'bird', '#ffe27a', '#fff8d6', '#8cc06a'],
  ['clover', 'Moss Frog', C, 'frog', '#7fc46c', '#e3f5d0', '#4e8a3a'],
  ['mossy', 'Moss Turtle', U, 'turtle', '#9ed98a', '#e8f7dc', '#5a8f3a'],
  ['shroomy', 'Mushroom Hedgehog', U, 'hedgehog', '#e8d5bf', '#fff6ea', '#d0503c'],
  ['hopper', 'Fairy Fox', U, 'fox', '#8fcf6a', '#f2fbe8', '#5a9e3a', { wings: true, wingColor: '#e0fff0' }],
  ['petal', 'Petal Lamb', U, 'lamb', '#ffd1e3', '#ffffff', '#ff9fc4'],
  ['twiggy', 'Forest Deer', R, 'deer', '#c08a5a', '#f5e1c8', '#8b5a2b'],
  ['dotty', 'Garden Owl', R, 'owl', '#a8c880', '#eef6e0', '#6a8f4a'],
  ['thistle', 'Pixie Cat', R, 'cat', '#c8a8ff', '#f3ecff', '#8a6cc4', { wings: true, wingColor: '#f0e6ff' }],
  ['glim', 'Crystal Deer', L, 'deer', '#8fe0b0', '#e6fff0', '#5fd0c0'],
  ['willow', 'Willow Unicorn', L, 'horse', '#f0fae6', '#ffffff', '#8cd46a', { horn: true }],
  ['bloom', 'Forest Spirit Dragon', D, 'dragon', '#7fc48a', '#e8f7dc', '#4e8a3a'],
]);
addSpecies('water', [
  ['bubbl', 'Bubble Fish', C, 'fish', '#8fd3ff', '#e0f4ff', '#4fa8e0'],
  ['guppy', 'Goldfish', C, 'fish', '#ffb84d', '#fff0d0', '#ff7a2a'],
  ['crabby', 'Puddle Duck', C, 'bird', '#fff3c4', '#ffffff', '#7fd0ff', { duck: true }],
  ['puddle', 'Pond Frog', C, 'frog', '#7fd0c8', '#e0f8f5', '#3fa8a0'],
  ['snaily', 'Bubble Dragon', C, 'dragon', '#9fdcff', '#e8f7ff', '#4fa8e0'],
  ['shelly', 'Shell Turtle', U, 'turtle', '#8fe0d0', '#e8fbf6', '#ffb38a'],
  ['ripple', 'Splash Kitten', U, 'cat', '#a8dcff', '#eef8ff', '#5aaee0'],
  ['starfy', 'Sea Bunny', U, 'bunny', '#bfe6ff', '#f0faff', '#7fc8ff'],
  ['otto', 'Kelpie', U, 'horse', '#5fb8c8', '#d8f4f8', '#2f7f9a'],
  ['jelly', 'Jelly Octopus', R, 'octopus', '#e0b8ff', '#f6ecff', '#b388ff'],
  ['narwy', 'Narwhal', R, 'seal', '#9ab8d8', '#eaf2fb', '#6a88b0', { horn: true }],
  ['puffer', 'Puffer Fish', R, 'fish', '#ffe27a', '#fff8d6', '#e0a100', { spiky: true }],
  ['coralyn', 'Mermaid Cat', L, 'cat', '#ff9fc4', '#ffe3ee', '#3fd0c9', { fishtail: true }],
  ['abyss', 'Leviathan Pup', L, 'dragon', '#4fa8e8', '#d0ecff', '#2f6fb0'],
  ['tidal', 'Coral Axolotl', D, 'axolotl', '#3fd0c9', '#d8fffb', '#ff7fb0'],
]);
addSpecies('fire', [
  ['cinder', 'Ember Fox', C, 'fox', '#ff8a4d', '#fff0dc', '#d65a1e'],
  ['ember', 'Fire Pup', C, 'dog', '#ffb07a', '#fff0e0', '#e0602a'],
  ['ashy', 'Ember Unicorn', C, 'horse', '#ffd8b8', '#fff3e8', '#ff7a2a', { horn: true }],
  ['sparky', 'Spark Chick', C, 'bird', '#ffd23f', '#fff5c2', '#ff8a3d'],
  ['coal', 'Coal Bear', C, 'bear', '#5a4a48', '#a08a80', '#ff7a1a'],
  ['blaze', 'Blaze Cat', U, 'cat', '#ff6a3d', '#ffd0b8', '#c0392b'],
  ['sala', 'Inferno Wolf', U, 'wolf', '#7a3a2a', '#d88a6a', '#ff5a2a'],
  ['foxfire', 'Fire Kitsune', U, 'fox', '#ff9a4d', '#fff0dc', '#d65a1e', { tails: 3 }],
  ['chili', 'Chili Hedgehog', U, 'hedgehog', '#ffd0b8', '#fff3ea', '#e8243c'],
  ['magmo', 'Magma Turtle', R, 'turtle', '#8a6a5c', '#d8b8a0', '#3b2f2f'],
  ['scorch', 'Fire Lion', R, 'lion', '#ffb84d', '#fff0d0', '#ff5a2a'],
  ['kindle', 'Dragon Cat', R, 'cat', '#ff7a4d', '#ffd8c0', '#c0392b', { dragonWings: true }],
  ['pyra', 'Fire Dragon', L, 'dragon', '#ff5a5a', '#ffd166', '#c0392b'],
  ['infernyx', 'Ember Salamander', L, 'axolotl', '#ff7a3d', '#ffd8b8', '#ffb000', { nogills: true, pattern: 'spots', pat: '#c0392b' }],
  ['solflare', 'Phoenix', D, 'bird', '#ffcf40', '#fff3c4', '#ff6a2a', { phoenix: true }],
]);
addSpecies('ice', [
  ['flurr', 'Snow Bunny', C, 'bunny', '#f8fbff', '#ffffff', '#c8dcf0'],
  ['pengo', 'Penguin', C, 'penguin', '#3a4a6a', '#ffffff', '#2a3550'],
  ['frosty', 'Snow Seal', C, 'seal', '#eef6ff', '#ffffff', '#c0d4e8'],
  ['icicle', 'Arctic Fox', C, 'fox', '#f2f7ff', '#ffffff', '#b8cce0'],
  ['sealy', 'Snow Pegasus', C, 'horse', '#f5f8fc', '#ffffff', '#a8c8e8', { wings: true }],
  ['tusky', 'Walrus', U, 'seal', '#a88878', '#e8d8c8', '#7a5a4c', { tusks: true }],
  ['snowy', 'Ice Kirin', U, 'deer', '#d8f0ff', '#ffffff', '#7fb2ff', { horn: true }],
  ['owlet', 'Ice Puffin', U, 'penguin', '#3a3f50', '#ffffff', '#2a2f40', { puffin: true }],
  ['yetti', 'Snow Hamster', U, 'mouse', '#ffffff', '#f0f4fa', '#c8d4e0'],
  ['glacia', 'Winged Ice Wolf', R, 'wolf', '#c8e4ff', '#f0f8ff', '#7fa8e0', { wings: true, wingColor: '#e8f6ff' }],
  ['polaris', 'Reindeer', R, 'deer', '#a07858', '#f0e0d0', '#6b4a32'],
  ['shardy', 'Crystal Hedgehog', R, 'hedgehog', '#e0f2ff', '#ffffff', '#7fc8ff'],
  ['aurok', 'Polar Bear', L, 'bear', '#f4f9ff', '#ffffff', '#a8d0f0'],
  ['blizzard', 'Frost Dragon', L, 'dragon', '#a8d8ff', '#e8f6ff', '#5a9ae0'],
  ['aurora', 'Frost Yeti', D, 'bear', '#cfe6ff', '#f2f8ff', '#7fb2ff', { pattern: 'stripes', pat: '#ffffff' }],
]);
addSpecies('candy', [
  ['gummy', 'Gummy Bear', C, 'bear', '#ff7fa8', '#ffc8da', '#e0507e'],
  ['beanie', 'Jelly Bean Frog', C, 'frog', '#8fe08f', '#e0fae0', '#4ab04a'],
  ['taffy', 'Taffy Bunny', C, 'bunny', '#ffb3a8', '#ffe8e4', '#ff8a7a'],
  ['mochi', 'Candy Unicorn', C, 'horse', '#ffe8f3', '#ffffff', '#ff9fcf', { horn: true }],
  ['gumdrop', 'Gumdrop Chick', C, 'bird', '#c8a8ff', '#ece0ff', '#9b7bd8'],
  ['lolli', 'Lollipop Lamb', U, 'lamb', '#ffd1e8', '#fff5fa', '#ff6fb5'],
  ['cuppy', 'Fairy Cupcake Cat', U, 'cat', '#ffe0c8', '#fff5ea', '#ff9fcf', { wings: true, wingColor: '#ffe8f6' }],
  ['choco', 'Choco Pup', U, 'dog', '#8b5a3c', '#e8c8a8', '#5a3420'],
  ['mintie', 'Mint Turtle', U, 'turtle', '#a8f0d0', '#e8fff4', '#ff9fcf'],
  ['sprinkle', 'Sprinkle Fox', R, 'fox', '#ffd1e8', '#ffffff', '#ff7fbf'],
  ['marshie', 'Marshmallow Seal', R, 'seal', '#ffffff', '#fff0f6', '#ffd6e8'],
  ['caramel', 'Caramel Dragon', R, 'dragon', '#f5c880', '#fff3e0', '#c8823a'],
  ['cocoa', 'Gingerbread Golem', L, 'bear', '#c8823a', '#e8b070', '#8b5a2b', { pattern: 'stripes', pat: '#ffffff' }],
  ['licorice', 'Licorice Panda', L, 'bear', '#ffffff', '#ffffff', '#2b2238', { panda: true }],
  ['sugarplum', 'Cotton Candy Fox', D, 'fox', '#f0c8ff', '#fff0fa', '#ff9fd8'],
]);
addSpecies('spooky', [
  ['boo', 'Ghost Cat', C, 'cat', '#f4f4ff', '#ffffff', '#c8c0e0', { ghostly: true }],
  ['webby', 'Spooky Toad', C, 'frog', '#6a8a5a', '#c8d8b8', '#3a5a2a'],
  ['bony', 'Skeleton Pup', C, 'dog', '#f0ece0', '#ffffff', '#3b3550'],
  ['wicky', 'Ghost Unicorn', C, 'horse', '#eef0ff', '#ffffff', '#b8b0e0', { horn: true, ghostly: true }],
  ['dusky', 'Dusk Owl', C, 'owl', '#8a7aa0', '#d8d0e6', '#5b4a7a'],
  ['batty', 'Vampire Bat', U, 'bat', '#5b4a7a', '#a996c9', '#3b2f4a'],
  ['zombo', 'Shadow Pegasus', U, 'horse', '#4a3d63', '#8a7aa0', '#2b2238', { dragonWings: true }],
  ['mummo', 'Mummy Bunny', U, 'bunny', '#f0e8d8', '#ffffff', '#c8b898', { pattern: 'stripes', pat: '#c8b898' }],
  ['crowly', 'Crow', U, 'bird', '#3b3550', '#5b5070', '#2b2238'],
  ['pumpy', 'Pumpkin Turtle', R, 'turtle', '#9ac08a', '#e0f0d8', '#ff9a3c'],
  ['wisp', 'Wisp Fox', R, 'fox', '#a8fff0', '#e8fffa', '#4fd8c0', { ghostly: true }],
  ['vampy', 'Werewolf', R, 'wolf', '#4a3d63', '#8a7aa0', '#2b2238'],
  ['hexa', 'Witch Cat', L, 'cat', '#3b3550', '#6b6080', '#2b2238', { hat: true }],
  ['gloom', 'Pumpkin Dragon', L, 'dragon', '#4a3d63', '#8a7aa0', '#ff9a3c'],
  ['phantom', 'Phantom Panther', D, 'cat', '#3b2f5a', '#5b4a7a', '#2b2238', { ghostly: true }],
]);
addSpecies('sky', [
  ['nimbi', 'Cloud Lamb', C, 'lamb', '#e8f0ff', '#ffffff', '#b8c8e8'],
  ['cumulo', 'Puff Bunny', C, 'bunny', '#e0ecff', '#ffffff', '#a8c0e8'],
  ['breezy', 'Breeze Bird', C, 'bird', '#9fd8ff', '#e8f6ff', '#5aa8e0'],
  ['chirpy', 'Winged Hamster', C, 'mouse', '#ffe6c8', '#fff8ee', '#f0b880', { wings: true }],
  ['kitey', 'Winged Cat', C, 'cat', '#ffd8a8', '#fff3e0', '#ff9a5c', { wings: true }],
  ['zephyr', 'Zephyr Fox', U, 'fox', '#7fe0c8', '#e8fff8', '#3fb8a0'],
  ['drizzle', 'Rain Frog', U, 'frog', '#9ab0d0', '#e0e8f5', '#6a80a8'],
  ['sunny', 'Sun Owl', U, 'owl', '#ffd84d', '#fff5c2', '#e0a100'],
  ['plume', 'Cloud Bear', U, 'bear', '#f0f4ff', '#ffffff', '#c8d4ea'],
  ['hoot', 'Feather Pup', R, 'dog', '#f5e6d3', '#ffffff', '#c9a27a', { wings: true }],
  ['prisma', 'Rainbow Unicorn', R, 'horse', '#ffffff', '#ffffff', '#ff9fcf', { horn: true }],
  ['gusty', 'Sky Kirin', R, 'deer', '#d8e4f5', '#ffffff', '#8aa0c8', { horn: true, wings: true }],
  ['stormy', 'Winged Cloud Lion', L, 'lion', '#fff8f0', '#ffffff', '#e8d8ff', { wings: true }],
  ['skyhoof', 'Pegasus', L, 'horse', '#f8f8ff', '#ffffff', '#b8c8ff', { wings: true }],
  ['solara', 'Celestial Griffin', D, 'bird', '#fffaf0', '#ffffff', '#ffd27f', { phoenix: true }],
]);
addSpecies('cyber', [
  ['bit', 'Robo Pup', C, 'dog', '#b8c4d0', '#eef2f6', '#5a6a80'],
  ['chip', 'Chip Mouse', C, 'mouse', '#c8d0d8', '#f0f3f6', '#3d8bd9'],
  ['volty', 'Volt Frog', C, 'frog', '#d8f05a', '#f5ffd0', '#8aa82a'],
  ['drone', 'Drone Bird', C, 'bird', '#8fd0ff', '#e0f4ff', '#5a6a80'],
  ['gizmo', 'Robo Unicorn', C, 'horse', '#c8d0d8', '#f0f3f6', '#3ff0ff', { horn: true }],
  ['byte', 'Byte Cat', U, 'cat', '#6ee7ff', '#dcfaff', '#1a8fa8'],
  ['servo', 'Mecha Dragon', U, 'dragon', '#a0a8b8', '#e0e4ea', '#3d8bd9'],
  ['neon', 'Neon Fox', U, 'fox', '#7cff9a', '#e0ffe8', '#1a8f3a'],
  ['laser', 'Laser Turtle', U, 'turtle', '#ff5a7a', '#ffd6de', '#3a4a6a'],
  ['pixel', 'Pixel Penguin', R, 'penguin', '#ff6ec7', '#ffe0f3', '#b03a8a'],
  ['holo', 'Holo Owl', R, 'owl', '#a8f0ff', '#ecfcff', '#3fb8d0'],
  ['turbo', 'Turbo Wolf', R, 'wolf', '#ff8a3d', '#ffe0c8', '#5a6a80'],
  ['mecha', 'Neon Cyber Cat', L, 'cat', '#2a2f4a', '#4a5070', '#3ff0ff'],
  ['nexus', 'Nexus Unicorn', L, 'horse', '#3a4a6a', '#7f9ac8', '#66ffff', { horn: true }],
  ['glitch', 'Holo-Wolf', D, 'wolf', '#5fe0e8', '#dcfcff', '#1a8fa8'],
]);
addSpecies('galaxy', [
  ['comet', 'Comet Cat', C, 'cat', '#3a3f7a', '#6b70b5', '#ffd23f'],
  ['luna', 'Moon Bunny', C, 'bunny', '#e8e6ff', '#ffffff', '#b8b2ff'],
  ['meteor', 'Star Unicorn', C, 'horse', '#e8e0ff', '#ffffff', '#b388ff', { horn: true, pattern: 'stars', pat: '#ffd23f' }],
  ['stardust', 'Stardust Mouse', C, 'mouse', '#f0e0ff', '#ffffff', '#b388ff'],
  ['zoomy', 'Rocket Pup', C, 'dog', '#ff9a9a', '#fff0f0', '#e05a5a', { helmet: true }],
  ['astro', 'Astro Penguin', U, 'penguin', '#2a2f5a', '#ffffff', '#1e2257', { helmet: true }],
  ['zorb', 'Alien Frog', U, 'frog', '#8fe08f', '#e0fae0', '#3fa83f'],
  ['moonbeam', 'Moon Owl', U, 'owl', '#fff3a8', '#fffbe0', '#d8c060'],
  ['quasar', 'Moon Pegasus', U, 'horse', '#4a3a8a', '#8a7ad0', '#c8b8ff', { wings: true, wingColor: '#d8d0ff' }],
  ['orbit', 'Orbit Octopus', R, 'octopus', '#8a6cff', '#d9d0ff', '#5a3fd0'],
  ['nova', 'Comet Dragon', R, 'dragon', '#ff9a3c', '#ffe0c8', '#c0501a'],
  ['eclipse', 'Eclipse Wolf', R, 'wolf', '#2b2238', '#ffd23f', '#1e1830'],
  ['nebula', 'Nebula Unicorn', L, 'horse', '#ff7ad9', '#ffd6f3', '#b388ff', { horn: true }],
  ['supernova', 'Cosmic Owl', L, 'owl', '#2a2f6a', '#8a9ae8', '#ffd23f'],
  ['cosmo', 'Nebula Kitsune', D, 'fox', '#7a5ad8', '#e0d4ff', '#ff8ad8', { pattern: 'stars', tails: 3 }],
]);

// Painted art cut from the Legendary/Divine concept picture (assets/pets/<id>.png).
for (const id of ['glim', 'bloom', 'abyss', 'tidal', 'infernyx', 'solflare', 'aurok', 'aurora', 'cocoa', 'sugarplum',
  'gloom', 'phantom', 'stormy', 'solara', 'mecha', 'glitch', 'supernova', 'cosmo']) SPECIES[id].img = `assets/pets/${id}.png?v=3`;

// Painted art generated in the concept style, one region at a time (assets/sheets/<region>.png -> assets/pets/<id>.png).
for (const id of Object.keys(SPECIES)) if (!SPECIES[id].img) SPECIES[id].img = `assets/pets/${id}.png?v=3`;   // every pet now has painted art

const FOODS = [
  { id: 'carrot',   icon: '🥕', name: 'Carrot',        cost: 8,    level: 1,   hunger: 12 },
  { id: 'apple',    icon: '🍎', name: 'Apple',         cost: 10,   level: 1,   hunger: 15 },
  { id: 'bread',    icon: '🍞', name: 'Bread',         cost: 18,   level: 1,   hunger: 25 },
  { id: 'banana',   icon: '🍌', name: 'Banana',        cost: 14,   level: 2,   hunger: 20, energy: 5 },
  { id: 'cookie',   icon: '🍪', name: 'Cookie',        cost: 16,   level: 2,   hunger: 12, happiness: 8 },
  { id: 'fish',     icon: '🐟', name: 'Fish',          cost: 30,   level: 2,   hunger: 40 },
  { id: 'cheese',   icon: '🧀', name: 'Cheese',        cost: 28,   level: 3,   hunger: 35 },
  { id: 'cake',     icon: '🍰', name: 'Cake',          cost: 45,   level: 3,   hunger: 30, happiness: 15 },
  { id: 'sandwich', icon: '🥪', name: 'Sandwich',      cost: 40,   level: 4,   hunger: 45 },
  { id: 'bone',     icon: '🍖', name: 'Big Bone',      cost: 60,   level: 5,   hunger: 60 },
  { id: 'pizza',    icon: '🍕', name: 'Pizza',         cost: 70,   level: 6,   hunger: 55, happiness: 10 },
  { id: 'sushi',    icon: '🍣', name: 'Sushi',         cost: 90,   level: 8,   hunger: 80, happiness: 10 },
  { id: 'burger',   icon: '🍔', name: 'Burger',        cost: 110,  level: 10,  hunger: 85 },
  { id: 'pasta',    icon: '🍝', name: 'Spaghetti',     cost: 130,  level: 12,  hunger: 90, happiness: 5 },
  { id: 'taco',     icon: '🌮', name: 'Taco',          cost: 150,  level: 15,  hunger: 90, happiness: 10 },
  { id: 'donut',    icon: '🍩', name: 'Donut',         cost: 160,  level: 18,  hunger: 50, happiness: 30 },
  { id: 'icecream', icon: '🍨', name: 'Ice Cream',     cost: 180,  level: 20,  hunger: 40, happiness: 35, thirst: 10 },
  { id: 'ramen',    icon: '🍜', name: 'Ramen',         cost: 220,  level: 24,  hunger: 100, thirst: 15 },
  { id: 'steak',    icon: '🥩', name: 'Steak',         cost: 280,  level: 30,  hunger: 100, energy: 15 },
  { id: 'bento',    icon: '🍱', name: 'Bento Box',     cost: 350,  level: 38,  hunger: 100, happiness: 20 },
  { id: 'cupcake',  icon: '🧁', name: 'Magic Cupcake', cost: 450,  level: 48,  hunger: 70, happiness: 40, energy: 10 },
  { id: 'pie',      icon: '🥧', name: 'Berry Pie',     cost: 600,  level: 60,  hunger: 100, happiness: 30, energy: 15 },
  { id: 'dumpling', icon: '🥟', name: 'Dumplings',     cost: 800,  level: 75,  hunger: 100, happiness: 35, energy: 25 },
  { id: 'honey',    icon: '🍯', name: 'Golden Honey',  cost: 1100, level: 95,  hunger: 100, happiness: 45, energy: 35 },
  { id: 'feast',    icon: '🎂', name: 'Party Cake',    cost: 1600, level: 120, hunger: 100, happiness: 60, energy: 50 },
  { id: 'starfruit',icon: '🌟', name: 'Star Fruit',    cost: 2500, level: 150, hunger: 100, happiness: 100, energy: 100, thirst: 50 },
];
/* Food, drinks and toys are served on painted dishes: a plate for food, a lace coaster for drinks,
   a soft cushion for toys. Fancier (higher-level) treats sparkle and glow. */
const DISH_BASE = {
  food: `<svg class="base" viewBox="0 0 100 40" aria-hidden="true">
    <ellipse cx="50" cy="24" rx="47" ry="14" fill="#b98a3e" opacity=".25"/>
    <ellipse cx="50" cy="20" rx="47" ry="15" fill="#e7c67a"/>
    <ellipse cx="50" cy="19" rx="43" ry="12.5" fill="#fffaf0"/>
    <ellipse cx="50" cy="20" rx="30" ry="8" fill="#f4e9d2"/>
    <path d="M14 15 Q30 8 52 8" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".9"/>
    <g fill="#e9a8b8"><circle cx="12" cy="21" r="1.6"/><circle cx="88" cy="21" r="1.6"/><circle cx="50" cy="31" r="1.6"/></g></svg>`,
  drink: `<svg class="base" viewBox="0 0 100 40" aria-hidden="true">
    <ellipse cx="50" cy="26" rx="44" ry="12" fill="#6b4320" opacity=".22"/>
    <ellipse cx="50" cy="22" rx="44" ry="14" fill="#b97b45"/>
    <ellipse cx="50" cy="20" rx="44" ry="14" fill="#d9a066"/>
    <path d="M14 20 Q50 12 86 20 M18 25 Q50 18 82 25" stroke="#c48a52" stroke-width="1" fill="none"/>
    <g fill="#fffdf6">${Array.from({ length: 14 }, (_, i) => { const t = i / 14 * Math.PI * 2; return `<circle cx="${(50 + Math.cos(t) * 30).toFixed(1)}" cy="${(19 + Math.sin(t) * 9).toFixed(1)}" r="3.2"/>`; }).join('')}</g>
    <ellipse cx="50" cy="19" rx="30" ry="9" fill="#fffdf6"/>
    <ellipse cx="50" cy="19" rx="22" ry="6" fill="#dff1ff"/>
    <ellipse cx="50" cy="19" rx="14" ry="3.6" fill="none" stroke="#a9d8ff" stroke-width="1.2" class="ripple"/>
    <path d="M18 14 Q34 8 50 8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/></svg>`,
  toy: `<svg class="base" viewBox="0 0 100 40" aria-hidden="true">
    <ellipse cx="50" cy="27" rx="46" ry="11" fill="#7a3d6a" opacity=".2"/>
    <ellipse cx="50" cy="22" rx="46" ry="14" fill="#ff9ac2"/>
    <ellipse cx="50" cy="21" rx="42" ry="12.5" fill="#ffd36e"/>
    <ellipse cx="50" cy="20.5" rx="37" ry="11" fill="#8fe0b0"/>
    <ellipse cx="50" cy="20" rx="32" ry="9.5" fill="#8fcfff"/>
    <ellipse cx="50" cy="19.5" rx="26" ry="8" fill="#fff4fa"/>
    <g fill="#ffd36e"><path d="M22 26 l1.4 3 3 .3 -2.3 2 .7 3 -2.8-1.6 -2.8 1.6 .7-3 -2.3-2 3-.3z" transform="translate(0 -8) scale(.9)"/></g>
    <g fill="#ff7fb0"><circle cx="80" cy="15" r="1.8"/><circle cx="70" cy="28" r="1.5"/></g>
    <g fill="#7f6bff"><circle cx="30" cy="13" r="1.5"/><circle cx="62" cy="11" r="1.3"/></g></svg>`,
};
const dishTier = it => it.level >= 100 ? 3 : it.level >= 40 ? 2 : it.level >= 10 ? 1 : 0;
const DISH_EXTRA = {
  food: '',
  drink: '<i class="bub b1"></i><i class="bub b2"></i><i class="bub b3"></i>',
  toy: '<i class="conf c1"></i><i class="conf c2"></i><i class="conf c3"></i><i class="conf c4"></i>',
};
const dishPic = (it, kind) => `<span class="dish dish-${kind} tier-${dishTier(it)}">${DISH_BASE[kind]}${DISH_EXTRA[kind]}<span class="dish-item">${it.icon}</span></span>`;
const DRINKS = [
  { id: 'water',    icon: '💧', name: 'Water',         cost: 5,    level: 1,   thirst: 20 },
  { id: 'milk',     icon: '🥛', name: 'Milk',          cost: 14,   level: 1,   thirst: 30 },
  { id: 'juice',    icon: '🧃', name: 'Juice Box',     cost: 25,   level: 2,   thirst: 40, happiness: 5 },
  { id: 'lemonade', icon: '🍋', name: 'Lemonade',      cost: 35,   level: 3,   thirst: 45, happiness: 5 },
  { id: 'smoothie', icon: '🥤', name: 'Smoothie',      cost: 45,   level: 4,   thirst: 60, hunger: 10 },
  { id: 'tea',      icon: '🍵', name: 'Warm Tea',      cost: 70,   level: 7,   thirst: 70, energy: 15 },
  { id: 'bubbletea',icon: '🧋', name: 'Bubble Tea',    cost: 110,  level: 12,  thirst: 80, happiness: 15 },
  { id: 'coconut',  icon: '🥥', name: 'Coconut Water', cost: 160,  level: 20,  thirst: 100, energy: 10 },
  { id: 'punch',    icon: '🍹', name: 'Fruit Punch',   cost: 240,  level: 30,  thirst: 100, happiness: 25 },
  { id: 'cocoa',    icon: '☕', name: 'Hot Cocoa',     cost: 380,  level: 45,  thirst: 100, happiness: 30, energy: 20 },
  { id: 'potion',   icon: '🧪', name: 'Magic Potion',  cost: 900,  level: 80,  thirst: 100, happiness: 40, energy: 60 },
];
const TOYS = [
  { id: 'ball',     icon: '⚽', name: 'Ball',          cost: 0,     level: 1,   happiness: 15 },
  { id: 'yarn',     icon: '🧶', name: 'Yarn Ball',     cost: 25,    level: 1,   happiness: 18 },
  { id: 'teddy',    icon: '🧸', name: 'Teddy',         cost: 60,    level: 2,   happiness: 22 },
  { id: 'duck',     icon: '🦆', name: 'Rubber Duck',   cost: 80,    level: 3,   happiness: 24 },
  { id: 'kite',     icon: '🪁', name: 'Kite',          cost: 120,   level: 4,   happiness: 28 },
  { id: 'frisbee',  icon: '🥏', name: 'Flying Disc',   cost: 150,   level: 5,   happiness: 30 },
  { id: 'yoyo',     icon: '🪀', name: 'Yo-yo',         cost: 200,   level: 6,   happiness: 35 },
  { id: 'puzzle',   icon: '🧩', name: 'Puzzle',        cost: 260,   level: 8,   happiness: 38 },
  { id: 'console',  icon: '🎮', name: 'Game Console',  cost: 400,   level: 9,   happiness: 45 },
  { id: 'drum',     icon: '🥁', name: 'Toy Drum',      cost: 500,   level: 12,  happiness: 48 },
  { id: 'balloon',  icon: '🎈', name: 'Balloons',      cost: 600,   level: 15,  happiness: 50 },
  { id: 'robot',    icon: '🤖', name: 'Robot Buddy',   cost: 800,   level: 20,  happiness: 55 },
  { id: 'paint',    icon: '🎨', name: 'Paint Set',     cost: 1000,  level: 25,  happiness: 58 },
  { id: 'skate',    icon: '🛹', name: 'Skateboard',    cost: 1200,  level: 30,  happiness: 60 },
  { id: 'carousel', icon: '🎠', name: 'Mini Carousel', cost: 1800,  level: 40,  happiness: 65 },
  { id: 'pinata',   icon: '🪅', name: 'Piñata',        cost: 2500,  level: 50,  happiness: 70 },
  { id: 'wheel',    icon: '🎡', name: 'Ferris Wheel',  cost: 3500,  level: 60,  happiness: 75 },
  { id: 'rocket',   icon: '🚀', name: 'Toy Rocket',    cost: 5000,  level: 75,  happiness: 80 },
  { id: 'circus',   icon: '🎪', name: 'Mini Circus',   cost: 7000,  level: 90,  happiness: 85 },
  { id: 'wand',     icon: '🪄', name: 'Magic Wand',    cost: 9000,  level: 110, happiness: 90 },
  { id: 'orb',      icon: '🔮', name: 'Wish Orb',      cost: 12000, level: 130, happiness: 95 },
  { id: 'star',     icon: '🌟', name: 'Wishing Star',  cost: 15000, level: 150, happiness: 100 },
];
// Playing costs a little energy, hunger and thirst.
const PLAY_COST = { energy: 8, hunger: 3, thirst: 4 };

// Room decorations. Walls/floors are backgrounds; items have a fixed spot in the room.
const DECOR = [
  { id: 'wall_plain',   type: 'wall',  name: 'Cream Wall',    cost: 0,   level: 1,  css: '#fff4dc' },
  { id: 'wall_stripes', type: 'wall',  name: 'Candy Stripes', cost: 80,  level: 2,  css: 'repeating-linear-gradient(90deg,#ffe3ec 0 22px,#fff5f8 22px 44px)' },
  { id: 'wall_stars',   type: 'wall',  name: 'Starry Night',  cost: 150, level: 4,  css: 'radial-gradient(#fff 2px,transparent 3px) 0 0/34px 34px,#2d3a6b' },
  { id: 'wall_garden',  type: 'wall',  name: 'Garden Sky',    cost: 250, level: 7,  css: 'linear-gradient(#bfe8ff,#e6f7d9)' },
  { id: 'wall_sunset',  type: 'wall',  name: 'Sunset',        cost: 400, level: 10, css: 'linear-gradient(#ff9a8b,#ffd59e)' },
  { id: 'floor_wood',   type: 'floor', name: 'Wood Floor',    cost: 0,   level: 1,  css: 'repeating-linear-gradient(90deg,#d39b67 0 44px,#c08655 44px 46px)' },
  { id: 'floor_tiles',  type: 'floor', name: 'Checker Tiles', cost: 100, level: 3,  css: 'conic-gradient(#dfe6f0 25%,#fff 0 50%,#dfe6f0 0 75%,#fff 0) 0 0/40px 40px' },
  { id: 'floor_grass',  type: 'floor', name: 'Grass Rug',     cost: 180, level: 5,  css: '#8fd46a' },
  { id: 'floor_carpet', type: 'floor', name: 'Purple Carpet', cost: 220, level: 6,  css: 'radial-gradient(#b89be8 2px,transparent 3px) 0 0/16px 16px,#9b7bd8' },
  { id: 'wall_mint', type: 'wall', name: 'Mint Dots', cost: 120, level: 3, css: "radial-gradient(#ffffff 3px,transparent 4px) 0 0/28px 28px,#c9f0dc" },
  { id: 'wall_hearts', type: 'wall', name: 'Sweet Hearts', cost: 180, level: 5, css: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22%3E%3Cpath d=%22M14 24 C2 15 4 6 10 6 C13 6 14 9 14 9 C14 9 15 6 18 6 C24 6 26 15 14 24Z%22 fill=%22%23ffb3cc%22/%3E%3Cg transform=%22translate(22 22) scale(.6)%22%3E%3Cpath d=%22M14 24 C2 15 4 6 10 6 C13 6 14 9 14 9 C14 9 15 6 18 6 C24 6 26 15 14 24Z%22 fill=%22%23ffb3cc%22/%3E%3C/g%3E%3C/svg%3E') 0 0/44px 44px,#fff0f5" },
  { id: 'wall_brick', type: 'wall', name: 'Cozy Brick', cost: 260, level: 8, css: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2230%22%3E%3Crect width=%2260%22 height=%2230%22 fill=%22%23e8a27c%22/%3E%3Cg fill=%22%23d98c66%22 stroke=%22%23f6d3bd%22 stroke-width=%222%22%3E%3Crect x=%221%22 y=%221%22 width=%2228%22 height=%2213%22 rx=%222%22/%3E%3Crect x=%2231%22 y=%221%22 width=%2228%22 height=%2213%22 rx=%222%22/%3E%3Crect x=%22-14%22 y=%2216%22 width=%2228%22 height=%2213%22 rx=%222%22/%3E%3Crect x=%2216%22 y=%2216%22 width=%2228%22 height=%2213%22 rx=%222%22/%3E%3Crect x=%2246%22 y=%2216%22 width=%2228%22 height=%2213%22 rx=%222%22/%3E%3C/g%3E%3C/svg%3E') 0 0/60px 30px" },
  { id: 'wall_ocean', type: 'wall', name: 'Under the Sea', cost: 450, level: 12, css: "radial-gradient(circle,rgba(255,255,255,.7) 3px,transparent 4px) 0 0/46px 52px,radial-gradient(circle,rgba(255,255,255,.45) 2px,transparent 3px) 20px 26px/46px 52px,linear-gradient(#8fdcff,#2f86c8)" },
  { id: 'wall_forest', type: 'wall', name: 'Forest', cost: 520, level: 15, css: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2270%22%3E%3Crect width=%2256%22 height=%2270%22 fill=%22%23dff3d0%22/%3E%3Cpath d=%22M14 18 L26 46 H2Z%22 fill=%22%237cc48a%22/%3E%3Crect x=%2212%22 y=%2246%22 width=%224%22 height=%228%22 fill=%22%23a0703c%22/%3E%3Cpath d=%22M42 30 L54 60 H30Z%22 fill=%22%235aa86a%22/%3E%3Crect x=%2240%22 y=%2260%22 width=%224%22 height=%228%22 fill=%22%23a0703c%22/%3E%3C/svg%3E') 0 0/56px 70px" },
  { id: 'wall_candy', type: 'wall', name: 'Candy Land', cost: 650, level: 20, css: "repeating-linear-gradient(45deg,#ffd1e3 0 16px,#fff6fa 16px 22px,#c8f2e0 22px 38px,#fff6fa 38px 44px,#fff2b8 44px 60px,#fff6fa 60px 66px)" },
  { id: 'wall_rainbow', type: 'wall', name: 'Rainbow Sky', cost: 800, level: 25, css: "linear-gradient(#ffc8c8,#ffe3b3 20%,#fff6b8 38%,#d4f5c8 56%,#c8e8ff 74%,#e3d4ff)" },
  { id: 'wall_castle', type: 'wall', name: 'Castle Stones', cost: 1000, level: 35, css: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2240%22%3E%3Crect width=%2264%22 height=%2240%22 fill=%22%23b9b4c8%22/%3E%3Cg fill=%22%23cfcadb%22 stroke=%22%239a94ad%22 stroke-width=%222%22%3E%3Crect x=%222%22 y=%222%22 width=%2228%22 height=%2216%22 rx=%225%22/%3E%3Crect x=%2234%22 y=%222%22 width=%2228%22 height=%2216%22 rx=%225%22/%3E%3Crect x=%22-14%22 y=%2222%22 width=%2228%22 height=%2216%22 rx=%225%22/%3E%3Crect x=%2218%22 y=%2222%22 width=%2228%22 height=%2216%22 rx=%225%22/%3E%3Crect x=%2250%22 y=%2222%22 width=%2228%22 height=%2216%22 rx=%225%22/%3E%3C/g%3E%3C/svg%3E') 0 0/64px 40px" },
  { id: 'wall_galaxy', type: 'wall', name: 'Galaxy', cost: 1500, level: 50, css: "radial-gradient(#fff 1.5px,transparent 2.5px) 0 0/40px 40px,radial-gradient(#ffe9a8 1px,transparent 2px) 18px 22px/52px 52px,radial-gradient(ellipse at 30% 40%,rgba(255,120,210,.55),transparent 50%),radial-gradient(ellipse at 75% 65%,rgba(110,160,255,.55),transparent 55%),#241a4f" },
  { id: 'wall_aurora', type: 'wall', name: 'Northern Lights', cost: 2200, level: 70, css: "radial-gradient(#fff 1px,transparent 2px) 0 0/36px 36px,linear-gradient(170deg,transparent 30%,rgba(110,255,190,.55) 45%,transparent 60%),linear-gradient(190deg,transparent 40%,rgba(180,130,255,.5) 55%,transparent 70%),linear-gradient(#0f2140,#2a3a6e)" },
  { id: 'floor_stone', type: 'floor', name: 'Garden Stones', cost: 140, level: 4, css: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2240%22%3E%3Crect width=%2260%22 height=%2240%22 fill=%22%23a7c98a%22/%3E%3Cg fill=%22%23e2dccd%22 stroke=%22%23c4bba6%22 stroke-width=%222%22%3E%3Cellipse cx=%2215%22 cy=%2212%22 rx=%2212%22 ry=%228%22/%3E%3Cellipse cx=%2245%22 cy=%2228%22 rx=%2213%22 ry=%228%22/%3E%3C/g%3E%3C/svg%3E') 0 0/60px 40px" },
  { id: 'floor_pink', type: 'floor', name: 'Pink Planks', cost: 220, level: 7, css: "repeating-linear-gradient(90deg,#f5b3c8 0 44px,#e897b0 44px 46px)" },
  { id: 'floor_sand', type: 'floor', name: 'Sandy Beach', cost: 300, level: 10, css: "radial-gradient(#e7c98e 1.5px,transparent 2.5px) 0 0/14px 14px,radial-gradient(#fff3d6 1px,transparent 2px) 7px 7px/18px 18px,#f6dfaa" },
  { id: 'floor_snow', type: 'floor', name: 'Snowy Floor', cost: 380, level: 14, css: "radial-gradient(#cfe8ff 2px,transparent 3px) 0 0/24px 24px,radial-gradient(#ffffff 3px,transparent 4px) 12px 12px/30px 30px,#eef7ff" },
  { id: 'floor_hex', type: 'floor', name: 'Honeycomb', cost: 480, level: 18, css: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2242%22 height=%2248%22%3E%3Crect width=%2242%22 height=%2248%22 fill=%22%23ffd77a%22/%3E%3Cg fill=%22%23ffe8a8%22 stroke=%22%23e8b23e%22 stroke-width=%222%22%3E%3Cpath d=%22M21 2 L39 12 V34 L21 44 L3 34 V12Z%22/%3E%3C/g%3E%3C/svg%3E') 0 0/42px 48px" },
  { id: 'floor_cloud', type: 'floor', name: 'Cloud Floor', cost: 650, level: 24, css: "radial-gradient(circle at 30% 40%,#ffffff 12px,transparent 13px) 0 0/50px 34px,radial-gradient(circle at 70% 60%,#ffffff 10px,transparent 11px) 0 0/50px 34px,#d6ecff" },
  { id: 'floor_marble', type: 'floor', name: 'Royal Marble', cost: 900, level: 35, css: "conic-gradient(#ffffff 25%,#f3e6c4 0 50%,#ffffff 0 75%,#f3e6c4 0) 0 0/46px 46px" },
  { id: 'floor_lava', type: 'floor', name: 'Lava Rock', cost: 1200, level: 45, css: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2240%22%3E%3Crect width=%2260%22 height=%2240%22 fill=%22%234a3a3a%22/%3E%3Cpath d=%22M0 14 Q14 8 24 18 T60 16 M10 40 Q22 28 36 32 T58 26%22 stroke=%22%23ff8a3a%22 stroke-width=%223%22 fill=%22none%22 stroke-linecap=%22round%22/%3E%3C/svg%3E') 0 0/60px 40px" },
  { id: 'floor_stars', type: 'floor', name: 'Star Path', cost: 1800, level: 60, css: "radial-gradient(#fff6b8 2px,transparent 3px) 0 0/26px 26px,radial-gradient(#ffffff 1px,transparent 2px) 13px 13px/20px 20px,#2c2f6e" },
  { id: 'basket', type: 'bed', name: 'Pet Basket',  icon: '🧺', cost: 0,    level: 1,  sleep: 1,    size: 3.2 },
  { id: 'nest',   type: 'bed', name: 'Cozy Nest',   icon: '🪺', cost: 150,  level: 3,  sleep: 1.25, size: 3.2 },
  { id: 'bigbed', type: 'bed', name: 'Comfy Bed',   icon: '🛏️', cost: 400,  level: 8,  sleep: 1.5,  size: 3.4 },
  { id: 'tent',   type: 'bed', name: 'Camping Tent', icon: '⛺', cost: 800,  level: 15, sleep: 1.75, size: 3.4 },
  { id: 'cloud',  type: 'bed', name: 'Cloud Bed',   icon: '☁️', cost: 1500, level: 25, sleep: 2,    size: 3.6 },
  { id: 'hut',    type: 'bed', name: 'Dream Hut',   icon: '🛖', cost: 3000, level: 40, sleep: 2.5,  size: 3.6 },
  { id: 'royal',  type: 'bed', name: 'Royal Palace Bed', icon: '🏯', cost: 6000, level: 60, sleep: 3, size: 3.8 },
  { id: 'plant',    type: 'item', name: 'Plant',       icon: '🪴', cost: 40,  level: 1,  left: 91, bottom: 30, size: 3 },
  { id: 'picture',  type: 'item', name: 'Picture',     icon: '🖼️', cost: 60,  level: 2,  left: 8,  top: 10,   size: 2.8 },
  { id: 'couch',    type: 'item', name: 'Couch',       icon: '🛋️', cost: 130, level: 3,  left: 100, bottom: 3,  size: 3.2 },
  { id: 'window',   type: 'item', name: 'Window',      icon: '🪟', cost: 90,  level: 3,  left: 72, top: 8,    size: 3 },
  { id: 'clock',    type: 'item', name: 'Clock',       icon: '🕰️', cost: 100, level: 4,  left: 31, top: 3,    size: 2.2 },
  { id: 'books',    type: 'item', name: 'Books',       icon: '📚', cost: 140, level: 5,  left: 84, bottom: 32, size: 2.6 },
  { id: 'fishtank', type: 'item', name: 'Fish Tank',   icon: '🐠', cost: 200, level: 6,  left: 53, bottom: 34, size: 2.4 },
  { id: 'lantern',  type: 'item', name: 'Lantern',     icon: '🏮', cost: 110, level: 7,  left: 60, top: 0,    size: 2.2 },
  { id: 'tree',     type: 'item', name: 'Little Tree', icon: '🎄', cost: 300, level: 8,  left: 2,  bottom: 4,  size: 3.4 },
  { id: 'trophy',   type: 'item', name: 'Trophy',      icon: '🏆', cost: 400, level: 10, left: 28, top: 12,   size: 2.2 },
  { id: 'disco',    type: 'item', name: 'Disco Ball',  icon: '🪩', cost: 600, level: 12, left: 20, top: 0,    size: 2.4 },
  { id: 'chair',    type: 'item', name: 'Chair',        icon: '🪑', cost: 50,  level: 1,  left: 22, bottom: 4,  size: 2.6 },
  { id: 'tv',       type: 'item', name: 'TV',           icon: '📺', cost: 90,  level: 2,  left: 44, bottom: 34, size: 2.6 },
  { id: 'mirror',   type: 'item', name: 'Mirror',       icon: '🪞', cost: 70,  level: 2,  left: 88, top: 16,   size: 2.4 },
  { id: 'vase',     type: 'item', name: 'Flower Vase',  icon: '🏺', cost: 80,  level: 3,  left: 67, bottom: 36, size: 1.8 },
  { id: 'toybox',   type: 'item', name: 'Toy Corner',   icon: '🧸', cost: 100, level: 3,  left: 36, bottom: 2,  size: 2.2 },
  { id: 'radio',    type: 'item', name: 'Radio',        icon: '📻', cost: 110, level: 4,  left: 75, bottom: 35, size: 2 },
  { id: 'candles',  type: 'item', name: 'Candles',      icon: '🕯️', cost: 90,  level: 5,  left: 36, top: 32,   size: 1.6 },
  { id: 'guitar',   type: 'item', name: 'Guitar',       icon: '🎸', cost: 180, level: 6,  left: 36, bottom: 33, size: 2.2 },
  { id: 'crystal',  type: 'item', name: 'Crystal Ball', icon: '🔮', cost: 450, level: 11, left: 56, top: 30,   size: 1.6 },
  { id: 'rainbow',  type: 'item', name: 'Rainbow Sign', icon: '🌈', cost: 600, level: 15, left: 30, top: 2,    size: 2.4 },
  { id: 'castle',   type: 'item', name: 'Castle Model', icon: '🏰', cost: 800, level: 20, left: 86, top: 32,   size: 2 },
  { id: 'cactus', type: 'item', name: 'Cactus', icon: '🌵', cost: 45, level: 2, left: 96, bottom: 4, size: 2.4 },
  { id: 'balloons', type: 'item', name: 'Balloons', icon: '🎈', cost: 50, level: 2, left: 97, top: 2, size: 2.4 },
  { id: 'sunflower', type: 'item', name: 'Sunflower Pot', icon: '🌻', cost: 60, level: 3, left: 50, bottom: 2, size: 2 },
  { id: 'dresser', type: 'item', name: 'Dresser', icon: '🗄️', cost: 150, level: 4, left: 60, bottom: 33, size: 2.6 },
  { id: 'gifts', type: 'item', name: 'Gift Pile', icon: '🎁', cost: 90, level: 5, left: 26, bottom: 3, size: 2 },
  { id: 'moonlamp', type: 'item', name: 'Moon Lamp', icon: '🌙', cost: 120, level: 6, left: 16, top: 2, size: 2.2 },
  { id: 'butterfly', type: 'item', name: 'Butterfly Frame', icon: '🦋', cost: 140, level: 7, left: 22, top: 18, size: 2 },
  { id: 'piano', type: 'item', name: 'Piano', icon: '🎹', cost: 350, level: 9, left: 78, bottom: 33, size: 2.6 },
  { id: 'arcade', type: 'item', name: 'Arcade Game', icon: '🕹️', cost: 420, level: 14, left: 64, bottom: 2, size: 2.4 },
  { id: 'snowman', type: 'item', name: 'Snowman', icon: '⛄', cost: 380, level: 16, left: 9, bottom: 3, size: 2.8 },
  { id: 'telescope', type: 'item', name: 'Telescope', icon: '🔭', cost: 500, level: 18, left: 70, bottom: 30, size: 2.6 },
  { id: 'fountain', type: 'item', name: 'Fountain', icon: '⛲', cost: 750, level: 25, left: 58, bottom: 30, size: 2.8 },
  { id: 'unicorn', type: 'item', name: 'Unicorn Statue', icon: '🦄', cost: 900, level: 30, left: 96, bottom: 34, size: 2.4 },
  { id: 'crown', type: 'item', name: 'Crown Display', icon: '👑', cost: 1200, level: 40, left: 44, top: 30, size: 1.8 },
  { id: 'portal', type: 'item', name: 'Magic Portal', icon: '🌀', cost: 1600, level: 50, left: 14, top: 14, size: 2.8 },
  { id: 'shooting', type: 'item', name: 'Shooting Star', icon: '🌠', cost: 2000, level: 60, left: 66, top: 0, size: 2.4 },
  { id: 'rug_pink',    type: 'item', rug: true, name: 'Round Pink Rug', cost: 30,  level: 1, css: 'radial-gradient(#ffd1e3 40%,#ffb3d1 41% 55%,#ffd1e3 56%)' },
  { id: 'rug_rainbow', type: 'item', rug: true, name: 'Rainbow Rug',    cost: 120, level: 4, css: 'repeating-radial-gradient(#ff9a9a 0 8px,#ffd27f 8px 16px,#a8e6a1 16px 24px,#8fd3ff 24px 32px,#c8a8ff 32px 40px)' },
  { id: 'rug_star',    type: 'item', rug: true, name: 'Starry Rug',     cost: 260, level: 9, css: 'radial-gradient(#fff 1.5px,transparent 2.5px) 0 0/14px 14px,#3a3f7a' },
  { id: 'rug_heart', type: 'item', rug: true, name: 'Heart Rug', cost: 80, level: 3, css: 'radial-gradient(#ffb3c7 30%,#ff8fb0 31% 45%,#ffd1e0 46%)' },
  { id: 'rug_leaf', type: 'item', rug: true, name: 'Leaf Rug', cost: 150, level: 6, css: 'repeating-radial-gradient(#bfe6a8 0 8px,#9fd486 8px 16px)' },
  { id: 'rug_royal', type: 'item', rug: true, name: 'Royal Rug', cost: 700, level: 28, css: 'radial-gradient(#ffe38a 25%,#c0303c 26% 48%,#ffd23f 49% 54%,#c0303c 55%)' },
];
// Painted furniture art (more pieces get pictures later; the rest still use their emoji).
for (const id of ['plant', 'picture', 'couch', 'window', 'clock', 'books']) DECOR.find(d => d.id === id).img = `assets/decor/${id}.png?v=1`;
const decorPic = (d, h) => d.img ? `<img class="decor-img" src="${d.img}" alt="" style="height:${h}">` : d.icon;



/* ---------- Comfy bed drawings (viewBox 120 x 84) ---------- */
const pillow = (x, y, w, h, c, edge, dot) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${c}" stroke="${edge}" stroke-width="1.5"/><path d="M${x + 6} ${y + h / 2} Q${x + w / 2} ${y + h / 2 - 3} ${x + w - 6} ${y + h / 2}" stroke="${edge}" stroke-width="1" fill="none" opacity=".6"/>` +
  (dot ? `<g fill="${dot}" opacity=".85"><circle cx="${x + w * 0.28}" cy="${y + h * 0.32}" r="1.6"/><circle cx="${x + w * 0.55}" cy="${y + h * 0.7}" r="1.6"/><circle cx="${x + w * 0.76}" cy="${y + h * 0.36}" r="1.6"/></g>` : '');
const quilt = (x, y, w, h, c, line) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${c}"/>` +
  Array.from({ length: Math.floor(w / 14) }, (_, i) => `<path d="M${x + 14 * (i + 1)} ${y + 3} V${y + h - 3}" stroke="${line}" stroke-width="1.2" stroke-dasharray="3 3"/>`).join('') +
  `<path d="M${x + 3} ${y + h / 2} H${x + w - 3}" stroke="${line}" stroke-width="1.2" stroke-dasharray="3 3"/>`;
// The blanket a sleeping pet gets matches the bed it sleeps in.
const BED_SHEETS = {
  basket: { fill: '#ffd1e3', edge: '#e8a0c0', dot: '#ffffff', hem: '#fffdf6' },
  nest:   { fill: '#fff7e8', edge: '#d9bf94', dot: '#ffb3d1', hem: '#ffffff' },
  bigbed: { fill: '#8fb8ff', edge: '#6f9be8', dot: '#ffffff', hem: '#ffffff' },
  tent:   { fill: '#ff9fc4', edge: '#e07aa6', dot: '#fff3a8', hem: '#c8e4ff' },
  cloud:  { fill: '#e6ddff', edge: '#b9a8f0', dot: '#ffffff', hem: '#ffe3ee' },
  hut:    { fill: '#b388ff', edge: '#7d5cc4', dot: '#ece0ff', hem: '#fff3c4' },
  royal:  { fill: '#c0303c', edge: '#8f1f2a', dot: '#ffd23f', hem: '#ffffff' },
};
const BED_ART = {
  basket: () => `<ellipse cx="60" cy="72" rx="50" ry="8" fill="rgba(0,0,0,.12)"/>
    <path d="M10 44 Q12 74 60 74 Q108 74 110 44Z" fill="#d9a066" stroke="#a8702a" stroke-width="2.5"/>
    <path d="M18 52 H102 M16 60 H104 M22 67 H98" stroke="#b47c3c" stroke-width="2"/>
    <path d="M14 46 Q60 30 106 46 Q60 58 14 46Z" fill="#ffd1e3" stroke="#e8a0c0" stroke-width="2"/>
    ${pillow(70, 32, 30, 14, BED_SHEETS.basket.fill, BED_SHEETS.basket.edge, BED_SHEETS.basket.dot)}
    <path d="M10 44 Q60 36 110 44" stroke="#a8702a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  nest: () => `<ellipse cx="60" cy="72" rx="52" ry="8" fill="rgba(0,0,0,.12)"/>
    <ellipse cx="60" cy="54" rx="52" ry="20" fill="#a87a4a"/>
    <path d="M12 50 Q40 64 108 48 M14 58 Q60 70 106 56 M20 44 Q70 56 104 42" stroke="#7a5230" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="60" cy="46" rx="40" ry="12" fill="#fff7e8" stroke="#ecd8b8" stroke-width="2"/>
    <g fill="${BED_SHEETS.nest.fill}" stroke="${BED_SHEETS.nest.edge}" stroke-width="1.5"><circle cx="38" cy="42" r="9"/><circle cx="52" cy="38" r="10"/><circle cx="68" cy="39" r="10"/><circle cx="82" cy="43" r="8"/></g><g fill="${BED_SHEETS.nest.dot}"><circle cx="36" cy="40" r="1.6"/><circle cx="54" cy="35" r="1.6"/><circle cx="66" cy="42" r="1.6"/><circle cx="84" cy="41" r="1.6"/><circle cx="48" cy="42" r="1.4"/><circle cx="74" cy="36" r="1.4"/></g>
    <path d="M96 34 Q104 24 110 28 Q104 34 96 34Z" fill="#ffd1e3"/><path d="M18 36 Q12 26 6 30 Q12 36 18 36Z" fill="#c8e4ff"/>`,
  bigbed: () => `<ellipse cx="60" cy="78" rx="54" ry="5" fill="rgba(0,0,0,.12)"/>
    <rect x="6" y="14" width="22" height="62" rx="8" fill="#c98d5a" stroke="#8b5a2b" stroke-width="2"/>
    <rect x="10" y="66" width="104" height="10" rx="4" fill="#b07440"/>
    <rect x="14" y="44" width="100" height="24" rx="10" fill="#ffffff" stroke="#dcd2e6" stroke-width="2"/>
    ${pillow(18, 30, 34, 18, BED_SHEETS.bigbed.fill, BED_SHEETS.bigbed.edge, BED_SHEETS.bigbed.dot)}
    ${quilt(46, 40, 70, 28, '#8fb8ff', '#ffffff')}
    <path d="M46 44 Q50 38 58 40" stroke="#6f9be8" stroke-width="2" fill="none"/>`,
  tent: () => `<ellipse cx="60" cy="78" rx="54" ry="5" fill="rgba(0,0,0,.12)"/>
    <path d="M60 4 L110 76 H10Z" fill="#ffd27f" stroke="#d99a3a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M60 4 L42 76 M60 4 L78 76" stroke="#e8b45a" stroke-width="2"/>
    <path d="M60 30 L40 76 H80Z" fill="#5a3f6a"/>
    <path d="M60 30 Q46 50 40 76 L48 76 Q54 52 60 30Z" fill="#ff9fc4"/>
    ${pillow(44, 58, 32, 14, BED_SHEETS.tent.fill, BED_SHEETS.tent.edge, BED_SHEETS.tent.dot)}
    <path d="M14 70 Q60 64 106 70" stroke="#ffffff" stroke-width="0" fill="none"/>
    <g fill="#fff3a8"><circle cx="30" cy="48" r="2.5"/><circle cx="40" cy="34" r="2.5"/><circle cx="80" cy="34" r="2.5"/><circle cx="90" cy="48" r="2.5"/><circle cx="60" cy="16" r="2.5"/></g>
    <path d="M30 48 Q35 40 40 34 Q50 22 60 16 Q70 22 80 34 Q85 40 90 48" stroke="#d99a3a" stroke-width="1" fill="none"/>`,
  cloud: () => `<ellipse cx="60" cy="78" rx="52" ry="5" fill="rgba(160,190,255,.35)"/>
    <g fill="#ffffff" stroke="#d6e4ff" stroke-width="2"><circle cx="22" cy="52" r="18"/><circle cx="44" cy="40" r="22"/><circle cx="72" cy="38" r="24"/><circle cx="98" cy="50" r="18"/><rect x="14" y="48" width="92" height="24" rx="12"/></g>
    <rect x="16" y="50" width="88" height="20" rx="10" fill="#ffffff"/>
    ${pillow(26, 34, 30, 16, BED_SHEETS.cloud.fill, BED_SHEETS.cloud.edge, BED_SHEETS.cloud.dot)}
    ${quilt(50, 44, 54, 22, '#e6ddff', '#ffffff')}
    <path d="M100 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#ffd23f"/><path d="M14 20 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="#ffd23f"/>`,
  hut: () => `<ellipse cx="60" cy="78" rx="54" ry="5" fill="rgba(0,0,0,.12)"/>
    <path d="M8 34 Q60 -6 112 34Z" fill="#8a6cc4" stroke="#5b4a7a" stroke-width="2"/>
    <path d="M14 34 Q14 70 18 76 M106 34 Q106 70 102 76" stroke="#5b4a7a" stroke-width="3"/>
    <path d="M14 34 Q24 56 18 76 L26 76 Q34 54 30 34Z M106 34 Q96 56 102 76 L94 76 Q86 54 90 34Z" fill="#c8a8ff" opacity=".9"/>
    <rect x="24" y="50" width="72" height="24" rx="10" fill="#ffffff" stroke="#e0d4f5" stroke-width="2"/>
    ${pillow(30, 40, 28, 16, BED_SHEETS.hut.fill, BED_SHEETS.hut.edge, BED_SHEETS.hut.dot)}
    ${quilt(52, 48, 44, 24, '#b388ff', '#ece0ff')}
    <path d="M60 10 a7 7 0 1 0 6 10 a6 6 0 1 1 -6 -10z" fill="#ffd23f"/>`,
  royal: () => `<ellipse cx="60" cy="80" rx="56" ry="4" fill="rgba(0,0,0,.12)"/>
    <path d="M10 76 V20 M110 76 V20" stroke="#d99a00" stroke-width="4"/>
    <path d="M6 22 Q60 2 114 22 Q60 14 6 22Z" fill="#e0434f" stroke="#d99a00" stroke-width="2"/>
    <path d="M12 22 Q22 46 14 70 M108 22 Q98 46 106 70" stroke="#c0303c" stroke-width="7" fill="none" stroke-linecap="round" opacity=".85"/>
    <path d="M50 14 L54 4 L60 10 L66 4 L70 14Z" fill="#ffd23f" stroke="#d99a00" stroke-width="1.5"/>
    <rect x="16" y="28" width="22" height="44" rx="6" fill="#ffd23f" stroke="#d99a00" stroke-width="2"/>
    <rect x="18" y="50" width="94" height="22" rx="9" fill="#ffffff" stroke="#f0d8a8" stroke-width="2"/>
    ${pillow(22, 36, 26, 16, BED_SHEETS.royal.fill, BED_SHEETS.royal.edge, BED_SHEETS.royal.dot)}${pillow(36, 40, 24, 14, BED_SHEETS.royal.hem, BED_SHEETS.royal.edge, BED_SHEETS.royal.dot)}
    ${quilt(54, 46, 58, 26, '#c0303c', '#ffd23f')}
    <rect x="18" y="72" width="94" height="6" rx="3" fill="#d99a00"/>`,
};
const bedSVG = (id, w = 120) => `<svg viewBox="0 0 120 84" width="${w}" height="${Math.round(w * 0.7)}" xmlns="http://www.w3.org/2000/svg">${(BED_ART[id] || BED_ART.basket)()}</svg>`;

/* ======================= UTILITIES ======================= */

const $ = (s, root = document) => root.querySelector(s);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function weighted(list, weightOf) {
  const total = list.reduce((s, x) => s + weightOf(x), 0);
  let r = Math.random() * total;
  for (const x of list) { r -= weightOf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) + amt, ((n >> 8) & 255) + amt, (n & 255) + amt]
    .map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}
const decorById = id => DECOR.find(d => d.id === id);
const regionById = id => REGIONS.find(r => r.id === id);
function effText(it) {
  const parts = [];
  for (const s of STAT_INFO) if (it[s.key]) parts.push(`+${it[s.key]} ${s.icon}`);
  return parts.join(' ');
}

/* =================== STATE & SAVING =================== */

function newState() {
  const now = Date.now();
  return {
    v: 1, coins: 100, xp: 0, level: 1, lastTick: now,
    pets: [], activeId: null, nextId: 1,
    inv: { food: { apple: 3 }, drink: { water: 3 } },
    toys: ['ball'],
    decor: { owned: ['wall_plain', 'floor_wood', 'basket'], placed: [], wall: 'wall_plain', floor: 'floor_wood', bed: 'basket' },
    eggs: [{ id: 1, region: 'grass', readyAt: now }],    // a free starter egg, ready right away
    nextEgg: 2,
    dex: [],
    best: { catch: 0, memory: 0, bubbles: 0 },
    plays: {},
    profile: { name: (window.PETPALS_PLAYER || {}).name || 'Pet Pal', avatar: (window.PETPALS_PLAYER || {}).avatar || null, fav: null, joined: now },
    stats: { hatched: 0, fed: 0, drinks: 0, toys: 0, coinsEarned: 0 },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const base = newState();
      const s = Object.assign(base, JSON.parse(raw));
      s.inv = Object.assign({ food: {}, drink: {} }, s.inv);
      s.best = Object.assign({ catch: 0, memory: 0, bubbles: 0 }, s.best);
      s.plays = Object.assign({}, s.plays);
      s.profile = Object.assign({ name: 'Pet Pal', avatar: null, fav: null, joined: Date.now() }, s.profile);
      s.stats = Object.assign({ hatched: 0, fed: 0, drinks: 0, toys: 0, coinsEarned: 0 }, s.stats);
      if (!s.decor.bed) s.decor.bed = 'basket';
      return s;
    }
  } catch (e) { /* storage blocked or save broken: start fresh */ }
  return newState();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

let state = loadState();
const activePet = () => state.pets.find(p => p.id === state.activeId) || null;

/* ===================== PET DRAWING ===================== */

/* ---------- Animal drawing ----------
   Pets are drawn as chibi animals: a big round head on a small body.
   ANIMALS[name](colours, species) returns the parts that make that animal:
     back (behind everything), body, belly, ears (behind the head), head,
     headTop (on top of the head), face (muzzle etc.), over (nose, beak, whiskers),
     plus layout tweaks: eyeY, eyeX, mouth style, mouthY, cheekY, noFeet, noBelly, feetColor, eyeRing.
   THEMES[region] adds egg-themed decorations as the pet grows (Teen, then Adult). */

const mir = s => s + `<g transform="translate(200 0) scale(-1 1)">${s}</g>`;
const S = c => `stroke="${c.d}" stroke-width="3" stroke-linejoin="round"`;
const outlined = (d, w, fill, stroke) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w + 5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
const NOSE = '<ellipse cx="100" cy="110" rx="6" ry="4.5" fill="#2b2238"/>';
const PINK_NOSE = '<path d="M95 107 L105 107 L100 112Z" fill="#ff8fa3"/>';
const whiskers = c => mir(`<path d="M70 110 L50 106 M70 116 L50 118" stroke="${c.d}" stroke-width="2" stroke-linecap="round"/>`);
const muzzle = (c, rx, ry, cy) => `<ellipse cx="100" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.l}"/>`;
const pointyEars = (c, outer, inner) => mir(`<path d="${outer}" fill="${c.b}" ${S(c)}/><path d="${inner}" fill="${c.n}"/>`);
const roundEars = (c, x, y, r) => mir(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c.b}" ${S(c)}/><circle cx="${x}" cy="${y}" r="${r * 0.5}" fill="${c.n}"/>`);
const BEAK = '<path d="M91 108 L109 108 L100 122Z" fill="#ffa63d" stroke="#d9802a" stroke-width="2" stroke-linejoin="round"/>';
const sideWings = c => mir(`<ellipse cx="62" cy="150" rx="12" ry="21" fill="${c.a}" ${S(c)} transform="rotate(22 62 150)"/>`);
const featherWings = (fill, stroke) => mir(`<path d="M62 140 Q18 104 20 146 Q32 142 34 156 Q46 148 62 156Z" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>`);
const flowerAt = (x, y, c) => [0, 72, 144, 216, 288].map(a =>
  `<circle cx="${(x + 6 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(y + 6 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="5" fill="${c}"/>`).join('') +
  `<circle cx="${x}" cy="${y}" r="4" fill="#ffd23f"/>`;
const ring = (n, r1, r2, cx, cy, ry1, ry2) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2, s = 0.13;
  const p = (ang, rx, ry) => `${(cx + rx * Math.cos(ang)).toFixed(1)} ${(cy + ry * Math.sin(ang)).toFixed(1)}`;
  return `M${p(a - s, r1, ry1)} L${p(a, r2, ry2)} L${p(a + s, r1, ry1)}Z`;
}).join(' ');

const ANIMALS = {
  cat: (c, sp) => ({
    back: sp.fishtail
      ? `<path d="M128 164 Q170 166 178 140 Q172 168 190 182 Q160 186 128 178Z" fill="${c.a}" ${S(c)}/>`
      : `<path d="M134 162 Q178 156 166 116 Q160 104 150 112 Q160 134 132 148Z" fill="${sp.mask ? c.a : c.b}" ${S(c)}/>`,
    noFeet: !!sp.fishtail,
    ears: pointyEars(c, 'M60 78 L62 36 L92 60Z', 'M67 70 L68 48 L84 62Z'),
    face: sp.mask ? mir(`<path d="M58 96 Q68 82 96 92 Q98 106 84 108 Q66 108 58 96Z" fill="${c.a}"/>`) : '',
    over: PINK_NOSE + whiskers(c),
    eyeRing: sp.mask ? true : undefined,
    mouth: 'cat',
  }),
  dog: c => ({
    back: outlined('M134 156 Q166 140 158 116', 10, c.b, c.d),
    headTop: mir(`<ellipse cx="58" cy="92" rx="14" ry="27" fill="${c.a}" ${S(c)} transform="rotate(18 58 92)"/>`),
    face: muzzle(c, 21, 15, 116),
    over: NOSE,
    mouth: 'snout',
  }),
  fox: c => ({
    back: `<path d="M132 168 Q192 162 178 108 Q172 94 160 102 Q168 134 130 150Z" fill="${c.b}" ${S(c)}/><path d="M178 108 Q172 94 160 102 Q164 114 174 120Z" fill="#ffffff"/>`,
    ears: pointyEars(c, 'M56 82 L54 26 L94 58Z', 'M63 72 L62 40 L84 60Z'),
    face: `<path d="M56 100 Q100 156 144 100 Q124 120 100 112 Q76 120 56 100Z" fill="${c.l}"/>`,
    over: '<ellipse cx="100" cy="110" rx="5" ry="4" fill="#2b2238"/>',
    mouth: 'cat',
  }),
  wolf: c => ({
    back: `<path d="M132 166 Q190 156 172 112 Q166 100 156 108 Q164 136 130 150Z" fill="${c.b}" ${S(c)}/>`,
    ears: pointyEars(c, 'M60 76 L56 22 L90 54Z', 'M66 66 L64 38 L82 56Z'),
    face: muzzle(c, 19, 14, 117),
    over: NOSE,
    mouth: 'snout',
  }),
  bear: (c, sp) => ({
    ears: mir(`<circle cx="62" cy="58" r="16" fill="${sp.panda ? c.a : c.b}" ${S(c)}/>${sp.panda ? '' : `<circle cx="62" cy="58" r="8" fill="${c.n}"/>`}`),
    face: (sp.panda ? mir(`<ellipse cx="82" cy="98" rx="13" ry="16" fill="${c.a}" transform="rotate(25 82 98)"/>`) : '') + muzzle(c, 18, 13, 116),
    over: NOSE,
    mouth: 'snout',
    eyeRing: sp.panda ? true : undefined,
    feetColor: sp.panda ? c.a : null,
  }),
  mouse: c => ({
    back: '<path d="M134 166 Q178 172 172 142 Q168 128 180 120" fill="none" stroke="#ffb3c6" stroke-width="4" stroke-linecap="round"/>',
    ears: roundEars(c, 56, 60, 22),
    over: PINK_NOSE + whiskers(c),
    mouth: 'cat',
  }),
  bunny: c => ({
    back: `<circle cx="138" cy="166" r="12" fill="#ffffff" stroke="${c.d}" stroke-width="2"/>`,
    ears: mir(`<ellipse cx="80" cy="36" rx="12" ry="32" fill="${c.b}" ${S(c)} transform="rotate(-10 80 36)"/><ellipse cx="80" cy="40" rx="6" ry="22" fill="${c.n}" transform="rotate(-10 80 40)"/>`),
    over: PINK_NOSE,
    mouth: 'cat',
  }),
  lamb: c => {
    const wool = shade(c.l, -25);
    const puff = list => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.l}" stroke="${wool}" stroke-width="2"/>`).join('');
    return {
      body: puff([[72, 150, 20], [128, 150, 20], [100, 142, 22], [80, 168, 18], [120, 168, 18], [100, 166, 20]]),
      noBelly: true,
      ears: mir(`<ellipse cx="52" cy="98" rx="15" ry="8" fill="${c.b}" ${S(c)} transform="rotate(-25 52 98)"/>`),
      headTop: puff([[72, 64, 13], [86, 54, 14], [100, 50, 15], [114, 54, 14], [128, 64, 13]]),
      over: PINK_NOSE,
      mouth: 'cat',
    };
  },
  deer: c => ({
    back: mir(`<path d="M82 58 L72 24 M76 38 L60 30 M73 29 L79 16" stroke="${c.a}" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    ears: mir(`<ellipse cx="52" cy="78" rx="17" ry="8" fill="${c.b}" ${S(c)} transform="rotate(-30 52 78)"/>`),
    face: muzzle(c, 18, 13, 116) + '<circle cx="130" cy="152" r="3" fill="#fff"/><circle cx="122" cy="166" r="2.5" fill="#fff"/><circle cx="74" cy="160" r="3" fill="#fff"/>',
    over: NOSE,
    mouth: 'snout',
  }),
  horse: (c, sp) => ({
    back: (sp.wings ? featherWings('#ffffff', '#c8d4ea') : '') + `<path d="M134 150 Q182 148 172 188 Q158 172 134 168Z" fill="${c.a}" ${S(c)}/>`,
    ears: pointyEars(c, 'M70 64 L70 32 L90 54Z', 'M74 58 L74 40 L85 53Z'),
    headTop: `<path d="M70 62 Q96 30 132 56 Q124 66 116 58 Q110 68 102 58 Q94 68 88 58 Q80 68 70 62Z" fill="${c.a}" ${S(c)}/>` +
      (sp.horn ? '<path d="M93 52 L100 8 L107 52Z" fill="#fff3a8" stroke="#e0b84d" stroke-width="2" stroke-linejoin="round"/><path d="M95 40 L105 36 M97 26 L103 23" stroke="#e0b84d" stroke-width="2"/>' : ''),
    face: muzzle(c, 24, 16, 120) + mir(`<ellipse cx="91" cy="120" rx="3" ry="4" fill="${c.d}"/>`),
    mouth: 'snout', mouthY: 130,
  }),
  dragon: c => ({
    back: mir(`<path d="M64 134 Q26 96 22 128 Q36 126 38 142 Q50 134 60 148Z" fill="${c.a}" ${S(c)}/>`) +
      `<path d="M132 166 Q178 170 184 138 L172 144 L176 126 L160 140 Q158 156 130 154Z" fill="${c.b}" ${S(c)}/>`,
    belly: `<ellipse cx="100" cy="158" rx="24" ry="18" fill="${c.l}"/><path d="M84 150 H116 M82 160 H118 M86 170 H114" stroke="${shade(c.l, -30)}" stroke-width="2"/>`,
    headTop: mir(`<path d="M78 60 L68 28 L92 52Z" fill="#fff3d6" ${S(c)}/>`),
    face: mir(`<ellipse cx="94" cy="112" rx="2.5" ry="3" fill="${c.d}"/>`),
    mouth: 'smile', mouthY: 120,
  }),
  bird: (c, sp) => ({
    back: sp.phoenix
      ? mir(`<path d="M64 140 Q8 100 12 56 Q28 90 40 86 Q32 112 56 118 Q38 128 66 152Z" fill="${c.a}" ${S(c)}/>`) +
        `<path d="M120 168 Q160 192 188 170 Q160 172 150 160 Q174 160 182 142 Q150 156 124 156Z" fill="${c.a}" ${S(c)}/>`
      : '',
    ears: sideWings(c),
    headTop: sp.phoenix
      ? `<path d="M96 54 Q80 20 94 8 Q96 30 102 32 Q104 14 118 6 Q110 30 108 54Z" fill="${c.a}" ${S(c)}/>`
      : `<path d="M96 54 Q90 34 100 40 Q104 28 108 44 Q118 36 110 54Z" fill="${c.a}"/>`,
    over: sp.duck ? '<ellipse cx="100" cy="114" rx="15" ry="7" fill="#ffa63d" stroke="#d9802a" stroke-width="2"/>' : BEAK,
    mouth: 'none',
    feetColor: '#ffa63d',
  }),
  owl: c => ({
    ears: sideWings(c) + mir(`<path d="M64 66 L58 36 L84 56Z" fill="${c.b}" ${S(c)}/>`),
    face: mir(`<circle cx="82" cy="98" r="18" fill="${c.l}"/>`),
    over: `<path d="M94 110 L106 110 L100 122Z" fill="#ffa63d" stroke="#d9802a" stroke-width="2" stroke-linejoin="round"/><path d="M90 150 l4 4 4 -4 M102 150 l4 4 4 -4 M96 162 l4 4 4 -4" stroke="${c.a}" stroke-width="2" fill="none"/>`,
    mouth: 'none',
    feetColor: '#ffa63d',
  }),
  penguin: (c, sp) => ({
    ears: mir(`<ellipse cx="60" cy="150" rx="9" ry="22" fill="${c.b}" ${S(c)} transform="rotate(25 60 150)"/>`),
    face: `<path d="M100 78 Q72 64 62 98 Q64 130 100 134 Q136 130 138 98 Q128 64 100 78Z" fill="${c.l}"/>`,
    over: sp.puffin
      ? '<path d="M88 106 L112 106 L100 126Z" fill="#ff7a3d" stroke="#c0501a" stroke-width="2" stroke-linejoin="round"/><path d="M92 112 L108 112" stroke="#ffd23f" stroke-width="3"/>'
      : '<path d="M92 108 L108 108 L100 118Z" fill="#ffa63d" stroke="#d9802a" stroke-width="2" stroke-linejoin="round"/>',
    mouth: 'none',
    feetColor: '#ffa63d',
    eyeRing: false,
  }),
  frog: c => ({
    head: `<ellipse cx="100" cy="102" rx="54" ry="40" fill="${c.b}" ${S(c)}/>`,
    ears: mir(`<circle cx="76" cy="68" r="19" fill="${c.b}" ${S(c)}/>`),
    eyeY: 66, eyeX: 24,
    mouth: 'wide', mouthY: 112, cheekY: 108,
  }),
  turtle: c => ({
    ears: `<ellipse cx="100" cy="148" rx="48" ry="33" fill="${c.a}" ${S(c)}/>` +
      `<path d="M100 126 L115 135 L115 153 L100 162 L85 153 L85 135Z M85 135 L62 132 M115 135 L138 132 M85 153 L66 166 M115 153 L134 166" fill="${shade(c.a, -20)}" stroke="${shade(c.a, -45)}" stroke-width="2"/>`,
    noBelly: true,
    mouth: 'smile',
  }),
  hedgehog: c => ({
    back: `<path d="M50 124 L34 108 L50 100 L38 80 L58 78 L52 56 L72 62 L72 40 L90 50 L100 30 L110 50 L128 40 L128 62 L148 56 L142 78 L162 80 L150 100 L166 108 L150 124 L164 144 L144 148 L152 170 L100 176 L48 170 L56 148 L36 144Z" fill="${c.a}" stroke="${shade(c.a, -35)}" stroke-width="2.5" stroke-linejoin="round"/>`,
    ears: roundEars(c, 66, 66, 10),
    face: `<ellipse cx="100" cy="110" rx="34" ry="28" fill="${c.l}"/>`,
    over: NOSE,
    mouth: 'snout',
  }),
  fish: (c, sp) => ({
    back: (sp.shark ? `<path d="M80 66 Q104 12 124 64Z" fill="${c.a}" ${S(c)}/>` : '') +
      (sp.spiky ? `<path d="${ring(16, 54, 70, 100, 114, 50, 66)}" fill="${c.a}" stroke="${shade(c.a, -30)}" stroke-width="2" stroke-linejoin="round"/>` : '') +
      `<path d="M150 112 L192 80 L184 112 L192 144Z" fill="${c.a}" ${S(c)}/>`,
    body: '', noFeet: true,
    head: `<ellipse cx="100" cy="114" rx="58" ry="54" fill="${c.b}" ${S(c)}/>`,
    belly: `<ellipse cx="100" cy="144" rx="34" ry="20" fill="${c.l}"/>`,
    headTop: mir(`<path d="M46 126 L22 112 L26 144Z" fill="${c.a}" ${S(c)}/>`),
    eyeY: 104, mouth: 'o', mouthY: 128, cheekY: 120,
  }),
  seal: (c, sp) => ({
    back: `<path d="M136 170 L172 156 L166 186Z" fill="${c.a}" ${S(c)}/>`,
    body: `<ellipse cx="100" cy="152" rx="46" ry="32" fill="${c.b}" ${S(c)}/>`,
    ears: mir(`<ellipse cx="58" cy="172" rx="17" ry="8" fill="${c.a}" ${S(c)} transform="rotate(-25 58 172)"/>`),
    noFeet: true,
    headTop: sp.horn ? '<path d="M96 54 L100 6 L104 54Z" fill="#fffbe8" stroke="#c8b88a" stroke-width="2" stroke-linejoin="round"/><path d="M97 42 L103 38 M98 28 L102 25" stroke="#c8b88a" stroke-width="2"/>' : '',
    face: muzzle(c, 20, 13, 116),
    over: NOSE + mir(`<circle cx="90" cy="117" r="1.6" fill="${c.d}"/><circle cx="86" cy="121" r="1.6" fill="${c.d}"/>`) +
      (sp.tusks ? mir('<path d="M90 122 L88 146 L95 124Z" fill="#fffbe8" stroke="#c8b88a" stroke-width="1.5"/>') : ''),
    mouth: sp.tusks ? 'none' : 'snout',
  }),
  axolotl: (c, sp) => ({
    back: `<path d="M132 160 Q182 162 188 130 Q176 150 130 146Z" fill="${c.b}" ${S(c)}/>`,
    ears: sp.nogills ? '' : mir(`<path d="M58 82 Q40 70 30 74 M54 96 Q34 94 26 100 M58 110 Q40 118 32 126" stroke="${c.a}" stroke-width="7" fill="none" stroke-linecap="round"/>`),
    head: `<ellipse cx="100" cy="100" rx="52" ry="42" fill="${c.b}" ${S(c)}/>`,
    mouth: 'wide', mouthY: 114, cheekY: 110,
  }),
  octopus: c => ({
    body: [46, 68, 90, 110, 132, 154].map(x => outlined(`M${x} 132 Q${x - 8} 158 ${x + 2} 174 Q${x + 8} 186 ${x - 2} 190`, 12, c.b, c.d)).join(''),
    noFeet: true, noBelly: true,
    head: `<ellipse cx="100" cy="98" rx="56" ry="54" fill="${c.b}" ${S(c)}/>`,
    mouth: 'o', mouthY: 124,
  }),
  otter: c => ({
    back: outlined('M134 168 Q182 174 178 140', 12, c.b, c.d),
    ears: roundEars(c, 64, 64, 10),
    face: muzzle(c, 22, 15, 116),
    over: NOSE + whiskers(c),
    mouth: 'snout',
  }),
  lion: (c, sp) => ({
    back: (sp.wings ? featherWings('#ffffff', '#c8d4ea') : '') + `<path d="M134 160 Q176 162 170 128" fill="none" stroke="${c.b}" stroke-width="6" stroke-linecap="round"/><circle cx="170" cy="124" r="9" fill="${c.a}"/>`,
    ears: Array.from({ length: 14 }, (_, i) => {
      const a = i / 14 * Math.PI * 2;
      return `<circle cx="${(100 + 50 * Math.cos(a)).toFixed(1)}" cy="${(96 + 50 * Math.sin(a)).toFixed(1)}" r="17" fill="${c.a}" stroke="${shade(c.a, -35)}" stroke-width="2"/>`;
    }).join('') + roundEars(c, 66, 58, 11),
    face: muzzle(c, 18, 13, 116),
    over: NOSE,
    mouth: 'snout',
  }),
  bat: c => ({
    back: mir(`<path d="M64 138 Q20 98 8 128 Q22 126 24 142 Q34 134 40 150 Q48 140 64 156Z" fill="${c.a}" ${S(c)}/>`),
    ears: pointyEars(c, 'M58 80 L48 26 L90 56Z', 'M64 72 L57 40 L82 58Z'),
    over: mir(`<path d="M92 119 L95 127 L98 119Z" fill="#fff" stroke="${c.d}" stroke-width="1"/>`),
    mouth: 'smile',
  }),
};

// Region decorations. Teen gets the first set, Adult adds the second.
// head = sits on top of the head (replaced by a crown/halo on Divine pets).
const THEMES = {
  grass: {
    teen: { head: '<path d="M100 54 Q98 42 102 34" stroke="#3f8f3f" stroke-width="4" fill="none"/><path d="M102 36 Q118 18 134 30 Q118 46 102 36Z" fill="#5cbf5c" stroke="#3f8f3f" stroke-width="2"/>' },
    adult: { front: flowerAt(134, 70, '#ff9fcf') + '<path d="M36 186 Q34 166 50 164 Q66 166 64 186Z" fill="#e8443c" stroke="#b02a24" stroke-width="2"/><circle cx="44" cy="174" r="3" fill="#fff"/><circle cx="55" cy="170" r="2.5" fill="#fff"/>' },
  },
  water: {
    teen: { front: '<g fill="rgba(200,235,255,.5)" stroke="#7fd0ff" stroke-width="2"><circle cx="162" cy="72" r="8"/><circle cx="174" cy="50" r="5"/><circle cx="36" cy="84" r="6"/></g>' },
    adult: { head: '<path d="M80 60 Q100 36 120 60 Z" fill="#ffd6e0" stroke="#e8a0b8" stroke-width="2"/><path d="M100 60 L100 44 M90 60 L94 46 M110 60 L106 46" stroke="#e8a0b8" stroke-width="1.5"/><circle cx="100" cy="60" r="7" fill="#ffffff" stroke="#c8d8f0" stroke-width="2"/>' },
  },
  fire: {
    teen: { head: '<path d="M100 58 Q86 48 92 32 Q97 42 102 38 Q100 26 112 18 Q108 36 116 44 Q116 58 100 58Z" fill="#ffb000"/><path d="M101 56 Q93 50 97 42 Q100 46 103 43 Q108 50 101 56Z" fill="#ff6a00"/>' },
    adult: { front: '<g fill="#ff8a1a"><circle cx="40" cy="72" r="3.5"/><circle cx="164" cy="62" r="3"/><circle cx="154" cy="40" r="2.5"/><circle cx="30" cy="104" r="2.5"/></g>' },
  },
  ice: {
    teen: { front: '<path d="M132 72 v14 M126 75 l12 8 M126 83 l12 -8" stroke="#7fc8ff" stroke-width="2.5" stroke-linecap="round"/>' },
    adult: { head: '<path d="M62 72 Q100 30 138 72 Q132 80 126 74 Q120 86 112 76 Q104 88 96 76 Q88 86 82 74 Q74 82 62 72Z" fill="#ffffff" stroke="#c8e4ff" stroke-width="2"/><path d="M84 76 L86 86 L89 76 M110 78 L112 90 L115 77" fill="#e0f4ff" stroke="#c8e4ff" stroke-width="1.5"/>' },
  },
  candy: {
    pattern: 'sprinkles',
    adult: { head: '<path d="M62 74 Q100 30 138 74 Q132 88 126 76 Q120 90 112 78 Q106 92 98 78 Q90 90 84 76 Q76 88 70 76 Q64 84 62 74Z" fill="#fff0f6" stroke="#ffb3d1" stroke-width="2"/><circle cx="100" cy="42" r="8" fill="#e8243c"/><path d="M100 34 Q104 24 112 22" stroke="#5a8f3a" stroke-width="2.5" fill="none"/>' },
  },
  spooky: {
    teen: { front: '<path d="M150 76 Q150 50 165 50 Q180 50 180 76 L176 72 L172 78 L168 72 L164 78 L160 72 L156 78 L152 72Z" fill="#f4f4ff" stroke="#b8b0d0" stroke-width="2" stroke-linejoin="round"/><circle cx="161" cy="62" r="2.2" fill="#2b2238"/><circle cx="169" cy="62" r="2.2" fill="#2b2238"/>' },
    adult: { front: '<circle cx="44" cy="176" r="13" fill="#ff9a3c" stroke="#c0601a" stroke-width="2"/><path d="M44 163 v-6" stroke="#5a8f3a" stroke-width="3"/><path d="M37 173 l3 -4 3 4Z M45 173 l3 -4 3 4Z" fill="#2b2238"/><path d="M37 180 Q44 186 51 180" stroke="#2b2238" stroke-width="2" fill="none"/>' },
  },
  sky: {
    teen: { back: featherWings('#ffffff', '#c8d4ea') },
    adult: { front: '<g fill="#ffffff" stroke="#d8e2f0" stroke-width="2"><circle cx="62" cy="186" r="12"/><circle cx="82" cy="190" r="14"/><circle cx="118" cy="190" r="14"/><circle cx="138" cy="186" r="12"/></g><rect x="60" y="186" width="80" height="14" fill="#ffffff"/>' },
  },
  cyber: {
    pattern: 'circuit',
    teen: { head: '<path d="M100 52 V32" stroke="#8a94a6" stroke-width="4"/><circle cx="100" cy="28" r="6" fill="#3ff0ff" stroke="#1a8fa8" stroke-width="2"/>' },
    adult: { front: '<path d="M54 98 Q54 46 100 46 Q146 46 146 98" fill="none" stroke="#3a4a6a" stroke-width="6"/><rect x="46" y="88" width="14" height="24" rx="6" fill="#3a4a6a"/><rect x="140" y="88" width="14" height="24" rx="6" fill="#3a4a6a"/><circle cx="53" cy="100" r="3" fill="#3ff0ff"/><circle cx="147" cy="100" r="3" fill="#3ff0ff"/>' },
  },
  galaxy: {
    pattern: 'stars',
    adult: { front: '<circle cx="164" cy="56" r="10" fill="#ffb84d" stroke="#d9802a" stroke-width="2"/><ellipse cx="164" cy="56" rx="18" ry="5" fill="none" stroke="#fff3c4" stroke-width="2.5" transform="rotate(-20 164 56)"/>' },
  },
};

// Fantasy parts any animal can have: wings, dragonWings, horn, antlers, tails (extra fox tails).
const UNICORN_HORN = '<path d="M93 54 L100 10 L107 54Z" fill="#fff3a8" stroke="#e0b84d" stroke-width="2" stroke-linejoin="round"/><path d="M95 42 L105 38 M97 28 L103 25" stroke="#e0b84d" stroke-width="2"/>';
function fantasyParts(sp, c) {
  let back = '', top = '';
  if (sp.wings && !['horse', 'lion'].includes(sp.animal)) back += featherWings(sp.wingColor || '#ffffff', sp.wingColor ? shade(sp.wingColor, -40) : '#c8d4ea');
  if (sp.dragonWings) back += mir(`<path d="M64 134 Q22 92 16 126 Q32 124 34 140 Q48 132 58 148Z" fill="${c.a}" ${S(c)}/>`);
  if (sp.antlers) back += mir(`<path d="M82 58 L72 24 M76 38 L60 30 M73 29 L79 16" stroke="${sp.antlerColor || '#8b5a2b'}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  if (sp.tails) {
    const tail = `<path d="M132 168 Q192 162 178 108 Q172 94 160 102 Q168 134 130 150Z" fill="${c.b}" ${S(c)}/><path d="M178 108 Q172 94 160 102 Q164 114 174 120Z" fill="${c.l}"/>`;
    for (let i = 1; i < sp.tails; i++) back += `<g transform="rotate(${i % 2 ? 34 : -30} 128 164)">${tail}</g>`;
  }
  if (sp.horn && !['horse', 'seal'].includes(sp.animal)) top += UNICORN_HORN;
  return { back, top };
}

// Extra details: eye colour per region, soft shine on head and body, toe lines, fur tufts.
const EYE_COLOR = { grass: '#5aa83a', water: '#2f8fd0', fire: '#e0601a', ice: '#5ab0e8', candy: '#e0508e', spooky: '#8a5ad0', sky: '#e8a020', cyber: '#1ab8c8', galaxy: '#7a5ad8' };
const FURRY = ['cat', 'dog', 'fox', 'wolf', 'bear', 'mouse', 'bunny', 'deer', 'horse', 'otter', 'lion', 'bat', 'hedgehog'];
const SHINE_DEFS = '<defs><radialGradient id="petShine" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></radialGradient></defs>';

const CROWN = '<path d="M78 58 L82 28 L93 44 L100 22 L107 44 L118 28 L122 58Z" fill="#ffd23f" stroke="#d99a00" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="47" r="4" fill="#ff4f9a"/><circle cx="87" cy="52" r="2.5" fill="#4dc3ff"/><circle cx="113" cy="52" r="2.5" fill="#4dc3ff"/>';
const HALO = '<ellipse cx="100" cy="30" rx="28" ry="8" fill="none" stroke="#ffcf1f" stroke-width="6"/>';
const WITCH_HAT = '<path d="M78 60 L104 6 Q110 2 110 10 L122 60Z" fill="#2b2238" stroke="#5b4a7a" stroke-width="2"/><rect x="81" y="50" width="40" height="7" fill="#b388ff"/><ellipse cx="100" cy="60" rx="44" ry="8" fill="#2b2238" stroke="#5b4a7a" stroke-width="2"/>';
const HELMET = '<circle cx="100" cy="96" r="60" fill="#cfe8ff" fill-opacity=".2" stroke="#e8f4ff" stroke-width="4"/><path d="M64 70 Q78 52 100 48" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>';

const PATTERNS = {
  spots: c => [[70, 76, 6], [132, 72, 5], [76, 152, 6], [126, 160, 7], [110, 172, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join(''),
  stripes: c => `<path d="M100 54 L100 66 M86 58 L88 68 M114 58 L112 68 M68 150 L82 152 M132 150 L118 152 M70 164 L84 164 M130 164 L116 164" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
  sprinkles: () => [[76, 70, '#ff4f9a', 30], [126, 66, '#4dc3ff', -20], [70, 154, '#ffd23f', 60], [130, 156, '#6cd47e', -40], [112, 172, '#b388ff', 10], [88, 172, '#ff8a3d', -50]]
    .map(([x, y, c, r]) => `<rect x="${x - 5}" y="${y - 2}" width="10" height="4" rx="2" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join(''),
  stars: c => [[72, 72, 3], [130, 68, 2.5], [72, 154, 2.5], [128, 160, 3], [112, 174, 2], [90, 172, 2]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('') +
    `<path d="M138 140 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="${c}"/>`,
  circuit: c => `<path d="M64 150 H78 V166 M136 150 H122 V166" stroke="${c}" stroke-width="3" fill="none"/><circle cx="78" cy="166" r="3.5" fill="${c}"/><circle cx="122" cy="166" r="3.5" fill="${c}"/>`,
};
const PATTERN_COLOR = { stars: '#ffffff', circuit: '#3ff0ff' };
const MOUTH_Y = { cat: 117, snout: 123, smile: 118, wide: 116, o: 126 };

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 110;
}

function petMood(p) {
  const vals = STAT_INFO.map(s => p[s.key]);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  if (min < 20 || avg < 35) return 'sad';
  if (avg >= 60 && min >= 30) return 'happy';
  return 'ok';
}

function mouthSVG(style, y, mood, sleeping, ink) {
  if (style === 'none') return '';
  if (sleeping) return `<ellipse cx="100" cy="${y + 2}" rx="4" ry="3" fill="${ink}"/>`;
  const st = `stroke="${ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"`;
  if (style === 'o') {
    if (mood === 'sad') return `<path d="M94 ${y + 5} Q100 ${y - 1} 106 ${y + 5}" fill="none" ${st}/>`;
    return mood === 'happy' ? `<ellipse cx="100" cy="${y}" rx="6" ry="7" fill="#ff8fa3" ${st}/>` : `<ellipse cx="100" cy="${y}" rx="4" ry="4" fill="${ink}"/>`;
  }
  const w = style === 'wide' ? 22 : 9;
  if (mood === 'happy') return `<path d="M${100 - w} ${y} Q100 ${y + w * 1.2 + 2} ${100 + w} ${y}Z" fill="#ff8fa3" ${st}/>`;
  if (mood === 'sad') return `<path d="M${100 - w} ${y + 7} Q100 ${y - 2} ${100 + w} ${y + 7}" fill="none" ${st}/>`;
  if (style === 'cat') return `<path d="M91 ${y} Q95.5 ${y + 5} 100 ${y} Q104.5 ${y + 5} 109 ${y}" fill="none" ${st}/>`;
  return `<path d="M${100 - w} ${y} Q100 ${y + w * 0.7} ${100 + w} ${y}" fill="none" ${st}/>`;
}

function petSVG(p, opts = {}) {
  const sp = SPECIES[p.species];
  const stage = p.stage;
  const scale = [0.74, 0.87, 1][stage];
  const mood = opts.mood || petMood(p);
  const sleeping = opts.awake ? false : p.sleeping;
  const darkBody = isDark(sp.body);
  const c = { b: sp.body, l: sp.belly, a: sp.accent || shade(sp.body, -25), d: shade(sp.body, -45) };
  c.n = darkBody ? shade(sp.body, 50) : '#ffc2d1';
  const A = ANIMALS[sp.animal](c, sp);
  const F = fantasyParts(sp, c);
  const furry = FURRY.includes(sp.animal);
  const ink = darkBody ? '#ffffff' : '#2b2238';
  const T = THEMES[sp.region] || {};

  // Region theme pieces for this stage.
  const th = { head: '', back: '', front: '' };
  if (stage >= 1 && T.teen) for (const k in T.teen) th[k] += T.teen[k];
  if (stage >= 2 && T.adult) for (const k in T.adult) th[k] += T.adult[k];
  let headItem = th.head;
  if (sp.rarity === 'divine' && stage >= 1) headItem = sp.region === 'sky' ? HALO : CROWN;
  if (sp.horn && sp.rarity !== 'divine') headItem = '';   // keep unicorn horns visible
  if (sp.hat) headItem = WITCH_HAT;
  if (sp.helmet) headItem = '';

  const patName = sp.pattern || (stage >= 1 ? T.pattern : null);
  const pattern = patName ? PATTERNS[patName](sp.pat || PATTERN_COLOR[patName] || c.d) : '';

  const body = A.body !== undefined ? A.body : `<ellipse cx="100" cy="152" rx="40" ry="30" fill="${c.b}" ${S(c)}/>`;
  const belly = A.noBelly ? '' : (A.belly || `<ellipse cx="100" cy="158" rx="24" ry="18" fill="${c.l}"/>`);
  const footC = A.feetColor || c.d;
  const feet = A.noFeet ? '' : mir(`<ellipse cx="80" cy="180" rx="13" ry="8" fill="${footC}"/><path d="M75 178 v4 M80 177 v5 M85 178 v4" stroke="${shade(footC, -35)}" stroke-width="1.6" stroke-linecap="round"/>`);
  const head = A.head || `<circle cx="100" cy="96" r="46" fill="${c.b}" ${S(c)}/>`;

  const ey = A.eyeY || 98, ex = A.eyeX || 18, er = [12, 10, 9][stage];
  const eyeRing = A.eyeRing !== undefined ? A.eyeRing : darkBody;
  let eyes;
  if (sleeping) {
    eyes = mir(`<path d="M${100 - ex - 10} ${ey} Q${100 - ex} ${ey + 9} ${100 - ex + 10} ${ey}" stroke="${eyeRing ? '#ffffff' : shade(sp.body, -90)}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
  } else {
    eyes = [-1, 1].map(s => {
      const x = 100 + s * ex;
      return `<circle cx="${x}" cy="${ey}" r="${er}" fill="#2b2238"${eyeRing ? ' stroke="#ffffff" stroke-width="2.5"' : ''}/>` +
        `<circle cx="${x}" cy="${ey + er * 0.25}" r="${er * 0.62}" fill="${sp.eye || EYE_COLOR[sp.region]}" opacity=".85"/><circle cx="${x}" cy="${ey + er * 0.25}" r="${er * 0.32}" fill="#1a1424"/>` +
        `<circle cx="${x + er * 0.35}" cy="${ey - er * 0.4}" r="${er * 0.38}" fill="#fff"/><circle cx="${x - er * 0.4}" cy="${ey + er * 0.45}" r="${er * 0.16}" fill="#fff"/>`;
    }).join('');
    if (mood === 'sad') eyes += mir(`<path d="M${100 - ex - 12} ${ey - 18} L${100 - ex + 8} ${ey - 13}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`);
  }
  const cy = A.cheekY || ey + 14;
  const cheeks = mir(`<ellipse cx="${100 - ex - 15}" cy="${cy}" rx="8" ry="5.5" fill="#ff9fb5" opacity=".6"/>`);
  const mouth = mouthSVG(A.mouth || 'smile', A.mouthY || MOUTH_Y[A.mouth || 'smile'], mood, sleeping, ink);

  const aura = sp.rarity === 'divine'
    ? '<defs><radialGradient id="divineAura"><stop offset="0" stop-color="#fff6a8" stop-opacity=".95"/><stop offset=".6" stop-color="#ffb3e6" stop-opacity=".45"/><stop offset="1" stop-color="#b388ff" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="112" r="98" fill="url(#divineAura)"/>'
    : '';
  const sparkle = sp.rarity === 'divine' ? '<text x="150" y="70" font-size="24">✨</text><text x="18" y="104" font-size="18">✨</text>'
    : sp.rarity === 'legendary' ? '<text x="152" y="70" font-size="22">✨</text>' : '';

  // Pets with painted art use their picture. In the room (opts.anim) they move with their mood.
  if (sp.img) {
    const size = 186 * scale;
    const x = (100 - size / 2).toFixed(1), y = (192 - size).toFixed(1), sz = size.toFixed(1);
    const moodState = sleeping ? 'sleep' : mood;
    const anim = opts.anim ? ` class="pet-body"` : '';
    const zzz = sleeping ? '<text x="140" y="70" font-size="26" fill="#5b5fc7" font-weight="700" class="zzz">z</text><text x="160" y="48" font-size="20" fill="#5b5fc7" font-weight="700" class="zzz" style="animation-delay:.6s">z</text><text x="176" y="30" font-size="15" fill="#5b5fc7" font-weight="700" class="zzz" style="animation-delay:1.2s">z</text>' : '';
    // A cozy quilt tucked over the pet while it sleeps, in the same colours as the bed's own quilt.
    const sheet = BED_SHEETS[state.decor.bed] || BED_SHEETS.basket;
    const blanket = sleeping ? `<g class="blanket">
      <path d="M26 197 L28 164 Q30 153 44 152 L156 152 Q170 153 172 164 L174 197 Z" fill="${sheet.fill}" stroke="${sheet.edge}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M36 194 L37 166 Q38 160 46 160 L154 160 Q162 160 163 166 L164 194" fill="none" stroke="${sheet.dot}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".8"/>
      <g fill="${sheet.dot}" opacity=".75"><circle cx="58" cy="176" r="3"/><circle cx="86" cy="184" r="3"/><circle cx="114" cy="174" r="3"/><circle cx="142" cy="184" r="3"/><circle cx="72" cy="190" r="2.4"/><circle cx="128" cy="190" r="2.4"/><circle cx="100" cy="166" r="2.4"/></g>
      <path d="M24 152 Q100 142 176 152 L176 163 Q100 155 24 163 Z" fill="${sheet.hem}" stroke="${sheet.edge}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M30 157 Q100 149 170 157" stroke="${sheet.edge}" stroke-width="1.6" fill="none" stroke-dasharray="3 3"/>
      <path d="M26 164 Q100 157 174 164" stroke="rgba(60,40,80,.18)" stroke-width="3" fill="none"/></g>` : '';
    const extras = !opts.anim || sleeping ? ''
      : mood === 'happy' ? '<text x="44" y="70" font-size="18" class="heart">💕</text><text x="150" y="80" font-size="16" class="heart" style="animation-delay:1.1s">💖</text><text x="100" y="40" font-size="14" class="heart" style="animation-delay:2s">💕</text>'
      : mood === 'sad' ? '<text x="146" y="66" font-size="20" class="sweat">💧</text>' : '';
    if (opts.anim) {
      // Back layer (shadow, glow) + front layer (blanket, sparkles, Zzz, hearts). The moving pet is drawn between them.
      return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="painted back">
      <ellipse cx="100" cy="190" rx="${50 * scale}" ry="7" fill="rgba(0,0,0,.15)"/>
      <g transform="translate(100 190) scale(${scale}) translate(-100 -190)">${aura}</g></svg>
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="painted front mood-${moodState}">${blanket}${sparkle}${zzz}${extras}</svg>`;
    }
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="painted mood-${moodState}">
    <ellipse cx="100" cy="190" rx="${50 * scale}" ry="7" fill="rgba(0,0,0,.15)"/>
    <g transform="translate(100 190) scale(${scale}) translate(-100 -190)">${aura}</g>
    <g${anim}><image href="${sp.img}" x="${x}" y="${y}" width="${sz}" height="${sz}" preserveAspectRatio="xMidYMax meet"/></g>
    ${blanket}${sparkle}${zzz}${extras}
  </svg>`;
  }
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    ${SHINE_DEFS}
    <ellipse cx="100" cy="190" rx="${50 * scale}" ry="7" fill="rgba(0,0,0,.15)"/>
    <g transform="translate(100 190) scale(${scale}) translate(-100 -190)"${sp.ghostly ? ' opacity=".85"' : ''}>
      ${aura}${th.back}${F.back}${A.back || ''}
      ${body}${A.body === undefined ? '<ellipse cx="100" cy="152" rx="40" ry="30" fill="url(#petShine)"/>' : ''}${belly}${feet}
      ${A.ears || ''}
      <ellipse cx="100" cy="140" rx="30" ry="7" fill="#000" opacity=".08"/>
      ${head}${A.head ? '' : '<circle cx="100" cy="96" r="46" fill="url(#petShine)"/>'}
      ${furry && !headItem && !A.headTop ? `<path d="M93 54 Q96 40 100 50 Q103 38 107 54" fill="${c.b}" stroke="${c.d}" stroke-width="2" stroke-linejoin="round"/>` : ''}
      ${furry ? mir(`<path d="M55 112 L48 116 L56 118 L51 124 L60 122" fill="${c.b}" stroke="${c.d}" stroke-width="2" stroke-linejoin="round"/>`) : ''}
      ${A.headTop || ''}${F.top}
      ${pattern}
      ${A.face || ''}
      ${eyes}${cheeks}${mouth}
      ${A.over || ''}
      ${th.front}
      ${headItem}
      ${sp.helmet ? HELMET : ''}
      ${sparkle}
    </g>
    ${sleeping ? '<text x="146" y="66" font-size="26" fill="#5b5fc7" font-weight="700" class="zzz">z</text><text x="166" y="44" font-size="18" fill="#5b5fc7" font-weight="700" class="zzz" style="animation-delay:.6s">z</text>' : ''}
  </svg>`;
}

// Egg pictures live in assets/eggs/<region id>.png
function eggSVG(regionId, size = 70) {
  const r = regionById(regionId);
  return `<img class="egg-img" src="assets/eggs/${r.id}.png" alt="${r.eggName}" style="height:${Math.round(size * 1.2)}px">`;
}

/* =================== UI HELPERS =================== */

const screen = $('#screen');
const modal = $('#modal');
const modalBox = $('#modalBox');
const modalQueue = [];
let modalOpen = false;

function openModal(html, onMount) {
  if (modalOpen) { modalQueue.push([html, onMount]); return; }
  modalOpen = true;
  modalBox.innerHTML = html;
  modal.classList.remove('hidden');
  if (onMount) onMount(modalBox);
}
function closeModal() {
  modal.classList.add('hidden');
  modalOpen = false;
  if (modalQueue.length) { const [h, m] = modalQueue.shift(); openModal(h, m); }
}
modal.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('[data-close]')) closeModal();
});

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function floatText(text) {
  const room = $('#room');
  if (!room) return;
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = (45 + Math.random() * 10) + '%';
  el.style.top = '35%';
  room.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function bouncePet() {
  const w = $('#petWrap');
  if (!w) return;
  w.classList.remove('jump');
  void w.offsetWidth;          // restart the animation
  w.classList.add('jump');
}

function updateHUD() {
  $('#lvlText').textContent = state.level;
  const av = profileAvatar();
  $('#avatarImg').src = av ? SPECIES[av].img : '';
  $('#avatarImg').style.visibility = av ? 'visible' : 'hidden';
  $('#profileBtn').classList.toggle('active', currentTab === 'profile');
  $('#profileBtn').classList.toggle('has-mail', !!(window.friendsInbox && window.friendsInbox()));
  $('#xpFill').style.width = (state.xp / xpNeed(state.level) * 100) + '%';
  $('#coinText').textContent = state.coins;
}

function updateBadges() {
  const pet = activePet();
  const needsCare = pet && STAT_INFO.some(s => pet[s.key] < 25) && !pet.sleeping;
  const eggReady = state.eggs.some(e => e.readyAt <= Date.now());
  setDot('room', needsCare);
  setDot('eggs', eggReady);
}
function setDot(tab, on) {
  const btn = $(`#nav button[data-tab="${tab}"]`);
  const dot = btn.querySelector('.dot');
  if (on && !dot) btn.insertAdjacentHTML('beforeend', '<i class="dot"></i>');
  if (!on && dot) dot.remove();
}

/* =================== LEVELING & CARE =================== */

// XP needed to go from level l to l+1. Grows slowly so level 155 is a long-term goal.
const xpNeed = l => 40 + 12 * l;

function addXP(n) {
  state.xp += n;
  while (state.xp >= xpNeed(state.level)) {
    state.xp -= xpNeed(state.level);
    state.level++;
    levelUp(state.level);
  }
  updateHUD();
}

function levelUp(l) {
  const bonus = l * 20;
  state.coins += bonus;
  const unlocks = [
    ...REGIONS.filter(r => r.level === l).map(r => `${r.emoji} New region: <b>${r.name}</b>`),
    ...Object.values(GAMES).filter(g => g.level === l).map(g => `🎮 New minigame: <b>${g.name}</b>`),
    ...[...FOODS, ...DRINKS, ...TOYS].filter(i => i.level === l && i.cost > 0).map(i => `${i.icon} ${i.name}`),
    ...DECOR.filter(d => d.level === l && d.cost > 0).map(d => `${d.icon || '🎨'} ${d.name}`),
  ];
  openModal(`<h2>🎉 Level ${l}!</h2>
    <p>You got <b>🪙 ${bonus}</b> bonus coins.</p>
    ${unlocks.length ? `<p>New things unlocked:</p><ul class="unlocks">${unlocks.map(u => `<li>${u}</li>`).join('')}</ul>` : ''}
    <button class="btn" data-close>Awesome!</button>`);
  save();
}

function checkEvolution() {
  for (const pet of state.pets) {
    if (pet.stage >= 2 || pet.pxp < EVOLVE_AT[pet.stage + 1]) continue;
    if (pet.happiness < 50) {
      if (!pet.evoHint && pet.id === state.activeId) {
        toast(`${pet.name} is ready to grow, but needs to be happier first!`);
        pet.evoHint = true;
      }
      continue;
    }
    pet.stage++;
    pet.evoHint = false;
    openModal(`<h2>✨ Evolution! ✨</h2>
      <div class="big-pet">${petSVG(pet, { awake: true, mood: 'happy' })}</div>
      <p><b>${esc(pet.name)}</b> grew into a <b>${STAGES[pet.stage]}</b>!</p>
      <button class="btn" data-close>Yay!</button>`);
    addXP(40);
    if (currentTab === 'room') render();
    save();
  }
}

// How much faster the current bed refills energy while sleeping (1 = normal).
const bedBonus = () => (decorById(state.decor.bed) || {}).sleep || 1;

const warned = {};   // which low-stat warnings have been shown

function simulate(dt, factor = 1, quiet = false) {
  for (const pet of state.pets) {
    const isActive = pet.id === state.activeId;
    const m = (isActive ? 1 : 0.3) * factor;   // pets not in the room get hungry slower
    if (pet.sleeping) {
      pet.energy += SLEEP_ENERGY_GAIN * bedBonus() * dt;
      pet.hunger -= RATES.hunger * 0.5 * m * dt;
      pet.thirst -= RATES.thirst * 0.5 * m * dt;
      if (pet.energy >= 100) {
        pet.energy = 100;
        pet.sleeping = false;
        if (isActive && !quiet) { toast(`☀️ ${pet.name} woke up full of energy!`); if (currentTab === 'room') render(); }
      }
    } else {
      for (const k of Object.keys(RATES)) pet[k] -= RATES[k] * m * dt;
      if (pet.hunger <= 0 || pet.thirst <= 0) pet.happiness -= 0.15 * m * dt;
      // A well cared-for pet slowly grows on its own.
      if (isActive && STAT_INFO.every(s => pet[s.key] >= 50)) pet.pxp += 0.15 * dt;
    }
    for (const s of STAT_INFO) pet[s.key] = clamp(pet[s.key]);

    if (isActive && !quiet) {
      for (const s of STAT_INFO) {
        const id = pet.id + s.key;
        if (pet[s.key] < 20 && !warned[id] && !pet.sleeping) {
          warned[id] = true;
          const msg = { hunger: 'is hungry! 🍗', thirst: 'is thirsty! 💧', happiness: 'is bored. Play with them! ⚽', energy: 'is sleepy. Time for bed! 🌙' }[s.key];
          toast(`${pet.name} ${msg}`);
        }
        if (pet[s.key] > 30) warned[id] = false;
      }
    }
  }
}

function careBlocked(pet) {
  if (!pet) { toast('Hatch an egg first!'); return true; }
  if (pet.sleeping) { toast(`${pet.name} is sleeping. Wake them up first!`); return true; }
  return false;
}

function useItem(kind, id) {
  const pet = activePet();
  closeModal();
  if (careBlocked(pet)) return;
  if (kind === 'toy') {
    const toy = TOYS.find(t => t.id === id);
    if (pet.energy < PLAY_COST.energy) { toast(`${pet.name} is too tired to play.`); return; }
    if (pet.happiness >= 98) { toast(`${pet.name} is already super happy!`); return; }
    pet.happiness = clamp(pet.happiness + toy.happiness);
    for (const k in PLAY_COST) pet[k] = clamp(pet[k] - PLAY_COST[k]);
    pet.pxp += 6;
    addXP(4);
    state.stats.toys++;
    floatText(toy.icon); setTimeout(() => floatText('💖'), 250);
  } else {
    const list = kind === 'food' ? FOODS : DRINKS;
    const item = list.find(i => i.id === id);
    const main = kind === 'food' ? 'hunger' : 'thirst';
    if (pet[main] >= 98) { toast(kind === 'food' ? `${pet.name} is full!` : `${pet.name} isn't thirsty.`); return; }
    if (!state.inv[kind][id]) return;
    state.inv[kind][id]--;
    for (const s of STAT_INFO) if (item[s.key]) pet[s.key] = clamp(pet[s.key] + item[s.key]);
    pet.pxp += 4;
    addXP(3);
    state.stats[kind === 'food' ? 'fed' : 'drinks']++;
    floatText(item.icon); setTimeout(() => floatText('😋'), 250);
  }
  bouncePet();
  updateRoom(true);
  save();
}

function openPicker(kind) {
  const pet = activePet();
  if (careBlocked(pet)) return;
  let items, title, empty, shopTabName;
  if (kind === 'food') {
    items = FOODS.filter(f => state.inv.food[f.id] > 0).map(f => ({ ...f, n: state.inv.food[f.id] }));
    title = `Feed ${esc(pet.name)}`; empty = 'You have no food.'; shopTabName = 'food';
  } else if (kind === 'drink') {
    items = DRINKS.filter(d => state.inv.drink[d.id] > 0).map(d => ({ ...d, n: state.inv.drink[d.id] }));
    title = `Give ${esc(pet.name)} a drink`; empty = 'You have no drinks.'; shopTabName = 'drink';
  } else {
    items = TOYS.filter(t => state.toys.includes(t.id));
    title = `Play with ${esc(pet.name)}`; empty = 'You have no toys.'; shopTabName = 'toys';
  }
  openModal(`<h2>${title}</h2>
    ${items.length ? `<div class="pick-grid">${items.map(i => `
      <button class="pick" data-id="${i.id}"><span class="ci">${dishPic(i, kind === 'food' || kind === 'drink' ? kind : 'toy')}</span>${i.name}
      <small>${effText(i)}${i.n ? ` · x${i.n}` : ''}</small></button>`).join('')}</div>`
      : `<p>${empty}</p>`}
    <button class="btn blue small" id="toShop">🛒 Buy more</button>
    <button class="btn ghost small" data-close>Close</button>`, box => {
    box.querySelectorAll('.pick').forEach(b => b.onclick = () => useItem(kind, b.dataset.id));
    $('#toShop', box).onclick = () => { closeModal(); shopTab = shopTabName; go('shop'); };
  });
}

function toggleSleep() {
  const pet = activePet();
  if (!pet) return;
  if (!pet.sleeping && pet.energy >= 90) { toast(`${pet.name} isn't sleepy yet.`); return; }
  if (petWalking) return;
  const wrap = $('#petWrap');
  const finish = () => {
    pet.sleeping = !pet.sleeping;
    const bed = decorById(state.decor.bed) || decorById('basket');
    toast(pet.sleeping ? `🌙 Good night, ${pet.name}! (${bed.icon} ${bed.name}: ⚡ x${bed.sleep})` : `☀️ ${pet.name} is awake!`);
    if (!pet.sleeping && currentTab === 'room') petLeavingBed = true;
    render();
    save();
  };
  // In the room the pet walks over to its bed first, then falls asleep.
  if (!pet.sleeping && wrap && currentTab === 'room') {
    petWalking = true;
    wrap.classList.add('walking', 'in-bed');
    setTimeout(() => { petWalking = false; if (activePet() === pet && !pet.sleeping) finish(); }, 1300);
  } else finish();
}
let petWalking = false, petLeavingBed = false;

let lastPat = 0;
function patPet() {
  const pet = activePet();
  if (!pet || pet.sleeping) return;
  const now = Date.now();
  if (now - lastPat < 2500) return;
  lastPat = now;
  pet.happiness = clamp(pet.happiness + 2);
  petPatAt = performance.now();
  floatText('💕');
  bouncePet();
  updateRoom(true);
}

/* ======================== SCREENS ======================== */

let currentTab = 'room';
let shopTab = 'food';
let activeGame = null;

function go(tab) {
  if (activeGame) { activeGame.stop(); activeGame = null; }
  currentTab = tab;
  render();
}

function render() {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
  ({ room: renderRoom, shop: renderShop, games: renderGames, eggs: renderEggs, pets: renderPets, profile: renderProfile }[currentTab] || (() => {}))();
  updateHUD();
  updateBadges();
}

/* ---------- Room ---------- */

function renderRoom() {
  const pet = activePet();
  const wall = decorById(state.decor.wall), floor = decorById(state.decor.floor);
  const items = state.decor.placed.map(decorById).filter(d => d && d.type === 'item');
  const bed = decorById(state.decor.bed) || decorById('basket');
  screen.innerHTML = `
    <div class="room ${pet && pet.sleeping ? 'night' : ''}" id="room">
      <div class="wall" style="background:${wall.css}"></div>
      <div class="floor" style="background:${floor.css}"></div>
      ${items.map(d => d.rug ? `<div class="rug" title="${d.name}" style="background:${d.css}"></div>` : `<div class="decor" title="${d.name}" style="left:${d.left}%;transform:translateX(-${d.left}%);${d.top != null ? `top:${d.top}%;z-index:1` : `bottom:${d.bottom}%;z-index:${Math.round(50 - d.bottom)}`};font-size:${(d.size * 1.4).toFixed(2)}rem">${decorPic(d, '1.3em')}</div>`).join('')}
      <div class="decor bed" title="${bed.name}" style="left:1%;bottom:25%;z-index:22">${bedSVG(bed.id, 190)}</div>
      ${pet ? `<div class="pet-wrap${pet.sleeping || petLeavingBed ? ' in-bed' : ''}" id="petWrap"></div>`
            : `<div class="no-pet"><p>Your room is empty! Hatch an egg to get a pet.</p><button class="btn" id="goEggs">🥚 Go to eggs</button></div>`}
      ${pet ? '<button class="speech" id="speech" type="button"></button>' : ''}
      <div class="night-veil"></div>
    </div>
    ${pet ? `
      <div class="pet-title"><b>${esc(pet.name)}</b> <span class="kind">${STAGES[pet.stage]} ${SPECIES[pet.species].name}</span></div>
      <div class="evo" id="evoRow"></div>
      <div class="care-row">${CARE.map(c => `
        <button class="care" data-care="${c.key}" type="button">
          <span class="ring">
            <svg viewBox="0 0 68 68" aria-hidden="true"><circle class="track" cx="34" cy="34" r="30"/><circle class="prog" id="r_${c.key}" cx="34" cy="34" r="30" stroke-dasharray="0 188.5" transform="rotate(-90 34 34)"/></svg>
            <span class="ci" id="i_${c.key}">${c.icon}</span><span class="alert" id="a_${c.key}">!</span>
          </span>
          <span class="cl" id="l_${c.key}">${c.label}</span><span class="cv" id="v_${c.key}"></span>
        </button>`).join('')}
      </div>` : ''}`;
  if (pet) {
    screen.querySelectorAll('[data-care]').forEach(b => b.onclick = () => careAction(b.dataset.care));
    $('#speech').onclick = () => { const need = petNeed(activePet()); if (need) careAction(need); else patPet(); };
    $('#petWrap').onclick = patPet;
  } else {
    $('#goEggs').onclick = () => go('eggs');
  }
  updateRoom(true);
  // Just woke up: hop out of bed and walk back to the middle of the room.
  if (petLeavingBed && pet) {
    petLeavingBed = false;
    const w = $('#petWrap');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      w.classList.add('walking'); w.classList.remove('in-bed');
      setTimeout(() => w.classList.remove('walking'), 1300);
    }));
  }
}

// The four care buttons double as the stat meters: the ring shows how full each bar is.
const CARE = [
  { key: 'hunger', act: 'food', icon: '🍗', label: 'Feed', color: '#f08a24', ask: "I'm hungry!" },
  { key: 'thirst', act: 'drink', icon: '🥤', label: 'Drink', color: '#2f8fd0', ask: "I'm thirsty!" },
  { key: 'happiness', act: 'toy', icon: '⚽', label: 'Play', color: '#2f9e57', ask: 'Play with me!' },
  { key: 'energy', act: 'sleep', icon: '🌙', label: 'Sleep', color: '#c98a00', ask: "I'm sleepy..." },
];
// The stat the pet needs most right now (or null if everything is fine).
function petNeed(pet) {
  if (!pet || pet.sleeping) return null;
  const low = CARE.filter(c => pet[c.key] < 40).sort((a, b) => pet[a.key] - pet[b.key]);
  return low.length ? low[0].key : null;
}
function careAction(key) {
  const c = CARE.find(x => x.key === key);
  if (c.act === 'sleep') toggleSleep(); else openPicker(c.act);
}

let petLook = '';
function updateRoom(force = false) {
  const pet = activePet();
  if (!pet || !$('#r_hunger')) return;
  const need = petNeed(pet);
  for (const c of CARE) {
    const v = pet[c.key];
    const ring = $('#r_' + c.key);
    ring.setAttribute('stroke-dasharray', `${(v / 100 * 188.5).toFixed(1)} 188.5`);
    ring.style.stroke = v <= 30 ? '#e0434f' : c.color;
    $('#v_' + c.key).textContent = Math.round(v) + '%';
    $('#a_' + c.key).style.display = (v < 25 && !pet.sleeping) || c.key === need && v < 40 ? 'flex' : 'none';
  }
  $('#i_energy').textContent = pet.sleeping ? '☀️' : '🌙';
  $('#l_energy').textContent = pet.sleeping ? 'Wake' : 'Sleep';
  const bubble = $('#speech');
  const mood = petMood(pet);
  bubble.textContent = pet.sleeping ? 'Zzz... so comfy!'
    : need ? CARE.find(c => c.key === need).ask
    : mood === 'happy' ? 'I feel great!' : 'Hi there!';
  bubble.classList.toggle('needy', !!need);
  // Only redraw the pet when its look changes, so its animation keeps playing smoothly.
  const look = `${pet.id}|${pet.stage}|${pet.sleeping}|${petMood(pet)}`;
  if (force || look !== petLook) { $('#petWrap').innerHTML = petSVG(pet, { anim: true }); petLook = look; startPetAnim(pet); }
  const evo = $('#evoRow');
  if (pet.stage < 2) {
    const need = EVOLVE_AT[pet.stage + 1], from = EVOLVE_AT[pet.stage];
    const pct = clamp((pet.pxp - from) / (need - from) * 100);
    evo.innerHTML = `<span>🌱 Grows into ${STAGES[pet.stage + 1]}</span><div class="bar" style="height:8px"><div class="fill" style="width:${pct}%"></div></div>`;
  } else {
    evo.innerHTML = `<span>🌟 Fully grown!</span>`;
  }
}


/* ---------- Living pet: draws the painted picture many times a second, gently bending it ----------
   The picture is drawn in thin horizontal strips. The feet stay put while higher strips sway more,
   and the whole body stretches/squishes, so the pet looks like it breathes, bobs and hops. */
let petAnimRaf = 0;
let petPatAt = -1e9;          // when the pet was last patted (for a happy face)

function startPetAnim(pet) {
  cancelAnimationFrame(petAnimRaf);
  const wrap = $('#petWrap');
  const sp = SPECIES[pet.species];
  if (!wrap || !sp.img) return;
  const cv = document.createElement('canvas');
  cv.className = 'pet-canvas';
  cv.width = 400; cv.height = 480;
  wrap.insertBefore(cv, wrap.querySelector('svg.front'));
  const ctx = cv.getContext('2d');
  const img = new Image();
  img.src = sp.img;
  const eyes = (window.PET_EYES || {})[pet.species] || null;
  // Pets with a tail: the tail area bends smoothly from where it joins the body, so the whole tail wags.
  const tail = (window.PET_TAILS || {})[pet.species] || null;
  let lid = null;                     // skin colour around each eye, used for eyelids
  const t0 = performance.now();
  const STEP = 2;
  let nextBlink = 1.5 + Math.random() * 2, blinkUntil = 0;
  let tearT = 0, bubbleT = 0;

  // Sample the fur colour just above each eye once the picture has loaded.
  img.onload = () => {
    if (!eyes) return;
    if (eyes.c) { lid = [eyes.c, eyes.c]; return; }   // a fixed eyelid colour (e.g. a visor)
    try {
      const off = document.createElement('canvas');
      off.width = img.naturalWidth; off.height = img.naturalHeight;
      const o = off.getContext('2d');
      o.drawImage(img, 0, 0);
      const r = eyes.s * img.naturalWidth;
      lid = ['l', 'r'].map(k => {
        const cx = eyes[k][0] * img.naturalWidth, cy = eyes[k][1] * img.naturalHeight;
        for (const [dx, dy] of [[0, -2.6], [0, -3.2], [k === 'l' ? -2.6 : 2.6, 0], [0, 2.6]]) {
          const d = o.getImageData(Math.round(cx + dx * r), Math.round(cy + dy * r), 1, 1).data;
          if (d[3] > 200) return `rgb(${d[0]},${d[1]},${d[2]})`;
        }
        return null;
      });
    } catch (e) { lid = null; }
  };

  function frame(now) {
    if (!cv.isConnected) return;
    petAnimRaf = requestAnimationFrame(frame);
    if (!img.complete || !img.naturalWidth) return;
    const p = activePet();
    if (!p) return;
    const t = (now - t0) / 1000;
    const patted = now - petPatAt < 1600;
    const need = petNeed(p);
    const mood = p.sleeping ? 'sleep' : patted ? 'happy' : petMood(p);
    const scale = [0.74, 0.87, 1][p.stage];
    const nw = img.naturalWidth, nh = img.naturalHeight, ratio = nw / nh, box = 186 * scale;
    const w = ratio >= 1 ? box : box * ratio, h = ratio >= 1 ? box / ratio : box;

    let sway = 0, stretch = 0, hop = 0, tilt = 0, drop = 0, hopping = false;
    if (mood === 'happy') {
      const c = (t % 1.6) / 1.6;
      if (c < 0.28) { hop = Math.sin(c / 0.28 * Math.PI) * 16; hopping = true; }
      stretch = c < 0.28 ? 0.06 * Math.sin(c / 0.28 * Math.PI)
              : c < 0.4 ? -0.08 * Math.sin((c - 0.28) / 0.12 * Math.PI)
              : 0.025 * Math.sin(t * 2 * Math.PI * 1.1);
    } else if (mood === 'ok') {
      stretch = 0.03 * Math.sin(t * 2 * Math.PI * 0.45);
    } else if (mood === 'sad') {
      stretch = -0.03 + 0.015 * Math.sin(t * 2 * Math.PI * 0.3);
    } else {
      stretch = -0.06 + 0.045 * Math.sin(t * 2 * Math.PI * 0.28);
      tilt = -8 * Math.PI / 180; drop = 6;
    }
    const hs = 1 + stretch, ws = 1 / Math.sqrt(hs), baseY = -hop;
    // Where a point of the picture (u across, v down, 0..1) ends up after bending.
    const map = (u, v) => {
      const up = 1 - v;
      const rowW = w * (1 + (ws - 1) * (1 - up * 0.5));
      return { x: -rowW / 2 + sway * Math.pow(up, 1.6) + u * rowW, y: baseY - (1 - v) * h * hs, k: rowW / w };
    };

    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 200, 240);
    ctx.translate(100, 232 + drop);
    ctx.rotate(tilt);
    if (mood === 'sad') ctx.filter = 'saturate(0.8)';
    const walking = wrap.classList.contains('walking');
    // Tail wag (side to side): fast and wide when happy or walking, gentle when ok, slow when sad, still when asleep.
    const amp = !tail || mood === 'sleep' ? 0 : mood === 'happy' || walking ? 0.34 : mood === 'ok' ? 0.16 : 0.06;
    const spd = mood === 'happy' || walking ? 3.2 : mood === 'ok' ? 1.3 : 0.5;
    const wag = amp * Math.sin(t * 2 * Math.PI * spd);
    const bandTop = tail ? Math.floor(tail.y0 * nh) : -1, bandBot = tail ? Math.ceil(tail.y1 * nh) : -1;
    const baseX = tail ? Math.round(tail.b * nw) : 0;
    const bandH = tail ? (tail.y1 - tail.y0) * h * hs : 0;
    const stepPh = t * 2 * Math.PI * 2.6;
    for (let sy = 0; sy < nh; sy += STEP) {
      const sh = Math.min(STEP, nh - sy);
      const up = 1 - (sy + sh / 2) / nh;
      const dy = baseY - (nh - sy) / nh * h * hs;
      const dh = sh / nh * h * hs + 0.7;
      const rowW = w * (1 + (ws - 1) * (1 - up * 0.5));
      const x0 = -rowW / 2 + sway * Math.pow(up, 1.6);
      // Which part of this row is body (the rest is tail, drawn swinging).
      let a0 = 0, a1 = nw;
      const inTail = tail && sy >= bandTop && sy < bandBot;
      if (inTail) { if (tail.s > 0) a1 = baseX; else a0 = baseX; }
      const X = u => x0 + rowW * u / nw;
      if (walking && up < 0.2) {                // walking to bed: the feet take turns stepping
        const k = 1 - up / 0.2, mid = nw / 2;
        const liftL = Math.max(0, Math.sin(stepPh)) * 7 * k, liftR = Math.max(0, -Math.sin(stepPh)) * 7 * k;
        if (Math.min(a1, mid) > a0) ctx.drawImage(img, a0, sy, Math.min(a1, mid) - a0, sh, X(a0), dy - liftL, X(Math.min(a1, mid)) - X(a0) + 0.5, dh);
        if (a1 > Math.max(a0, mid)) ctx.drawImage(img, Math.max(a0, mid), sy, a1 - Math.max(a0, mid), sh, X(Math.max(a0, mid)), dy - liftR, X(a1) - X(Math.max(a0, mid)), dh);
      } else if (a1 > a0) {
        ctx.drawImage(img, a0, sy, a1 - a0, sh, X(a0), dy, X(a1) - X(a0), dh);
      }
      if (inTail) {
        // The tail: its root stays joined to the body while higher up it swings further left and right.
        const f = (bandBot - sy) / Math.max(1, bandBot - bandTop);
        const off = wag * Math.pow(f, 1.4) * bandH;
        if (tail.s > 0) ctx.drawImage(img, baseX, sy, nw - baseX, sh, X(baseX), dy, X(nw) - X(baseX) + off, dh);
        else ctx.drawImage(img, 0, sy, baseX, sh, X(0) + off, dy, X(baseX) - X(0) - off, dh);
      }
    }
    ctx.filter = 'none';

    // ---- Face: blinking, closed eyes, happy squint, sad eyes, blush, tears ----
    if (eyes && lid) {
      if (t > nextBlink) { blinkUntil = t + 0.14; nextBlink = t + 2.5 + Math.random() * 3; }
      const face = mood === 'sleep' ? 'closed'
        : (patted || (mood === 'happy' && hopping)) ? 'squint'
        : t < blinkUntil ? 'closed'
        : mood === 'sad' ? 'droopy' : 'open';
      const R = eyes.s * w * 1.45;
      const pts = ['l', 'r'].map(k => map(eyes[k][0], eyes[k][1]));
      if (mood === 'happy' || patted) {          // rosy cheeks
        ctx.fillStyle = 'rgba(255,120,150,.35)';
        for (const [i, q] of pts.entries()) {
          ctx.beginPath();
          ctx.ellipse(q.x + (i ? 1 : -1) * R * 0.9, q.y + R * 1.5, R * 0.9, R * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Pets whose picture has no clear open eye get cartoon eyes drawn on.
      if (eyes.draw && (face === 'open' || face === 'droopy')) {
        pts.forEach((q, i) => {
          const r = R * q.k, col = lid[i] || lid[1 - i];
          if (col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.1, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = '#2b1d22';
          ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 0.72, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(q.x - r * 0.25, q.y - r * 0.32, r * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(q.x + r * 0.22, q.y + r * 0.3, r * 0.13, 0, Math.PI * 2); ctx.fill();
        });
      }
      if (face !== 'open') {
        pts.forEach((q, i) => {
          const r = R * q.k;
          const col = lid[i] || lid[1 - i];
          if (!col) return;
          ctx.fillStyle = col;
          ctx.strokeStyle = eyes.k || '#3b2a2a'; ctx.lineWidth = Math.max(1.6, r * 0.3); ctx.lineCap = 'round';
          if (face === 'droopy') {               // heavy, sad upper eyelid
            ctx.beginPath();
            ctx.arc(q.x, q.y, r * 1.05, Math.PI, 0);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(q.x - r, q.y + (i ? -r * 0.25 : r * 0.05));
            ctx.lineTo(q.x + r, q.y + (i ? r * 0.05 : -r * 0.25));
            ctx.stroke();
            return;
          }
          ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.08, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(q.x - r * 0.85, q.y);
          ctx.quadraticCurveTo(q.x, q.y + (face === 'squint' ? -r * 0.9 : r * 0.7), q.x + r * 0.85, q.y);
          ctx.stroke();
        });
      }
      if (mood === 'sad') {                      // a tear rolls down now and then
        tearT = (tearT + 1 / 60) % 3;
        if (tearT < 1.4) {
          const q = pts[0], ty = q.y + R * 1.2 + tearT * R * 3;
          ctx.globalAlpha = 1 - tearT / 1.4;
          ctx.fillStyle = '#7cc6fe';
          ctx.beginPath(); ctx.moveTo(q.x, ty - R * 0.7);
          ctx.quadraticCurveTo(q.x + R * 0.55, ty, q.x, ty + R * 0.45);
          ctx.quadraticCurveTo(q.x - R * 0.55, ty, q.x, ty - R * 0.7); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // ---- Emotion bubble above the head ----
    const icon = mood === 'sleep' ? '💤' : patted ? '💕' : need ? { hunger: '🍗', thirst: '💧', happiness: '⚽', energy: '😪' }[need]
      : mood === 'happy' ? '❤️' : mood === 'sad' ? '😢' : '';
    bubbleT += 1 / 60;
    if (icon && (mood !== 'happy' || patted || (bubbleT % 4) < 2.2)) {
      const top = map(0.78, 0.05);
      const pop = Math.min(1, ((bubbleT % 4) * 4)) * (1 + 0.05 * Math.sin(t * 6));
      const bx = Math.min(68, top.x + 18), by = Math.max(-214, top.y - 4);
      ctx.save();
      ctx.translate(bx, by); ctx.scale(pop, pop);
      ctx.fillStyle = 'rgba(255,253,246,.95)'; ctx.strokeStyle = '#d8bd7e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -16, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-12, 6); ctx.lineTo(2, -2); ctx.fill();
      ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, -15);
      ctx.restore();
    }
  }
  petAnimRaf = requestAnimationFrame(frame);
}

/* ---------- Shop ---------- */

function renderShop() {
  const tabs = [['food', '🍎 Food'], ['drink', '🥤 Drinks'], ['toys', '⚽ Toys'], ['decor', '🛋️ Furniture'], ['walls', '🎨 Walls & Floors']];
  let cards = '';
  const lockBtn = it => `<span class="lockpill">🔒 Opens at Lv ${it.level}</span>`;
  const buyBtn = (it, label) => `<button class="btn small" data-buy="${it.id}" ${state.coins < it.cost ? 'disabled' : ''}>${label || `🪙 ${it.cost}`}</button>`;

  if (shopTab === 'food' || shopTab === 'drink') {
    const list = shopTab === 'food' ? FOODS : DRINKS;
    cards = list.map(it => {
      const locked = state.level < it.level;
      return `<div class="card ${locked ? 'locked' : ''}"><div class="ci">${dishPic(it, shopTab)}</div><div class="cn">${it.name}</div>
        <div class="ce">${effText(it)}</div><div class="owned">You have ${state.inv[shopTab][it.id] || 0}</div>
        ${locked ? lockBtn(it) : buyBtn(it)}</div>`;
    }).join('');
  } else if (shopTab === 'toys') {
    cards = TOYS.map(it => {
      const locked = state.level < it.level, owned = state.toys.includes(it.id);
      return `<div class="card ${locked ? 'locked' : ''}"><div class="ci">${dishPic(it, 'toy')}</div><div class="cn">${it.name}</div>
        <div class="ce">${effText(it)}</div>
        ${owned ? '<button class="btn small green" disabled>Owned ✓</button>' : locked ? lockBtn(it) : buyBtn(it)}</div>`;
    }).join('');
  } else {
    cards = DECOR.filter(d => (shopTab === 'decor') === (d.type === 'item' || d.type === 'bed')).map(d => {
      const locked = state.level < d.level, owned = state.decor.owned.includes(d.id);
      const pic = d.type === 'bed' ? `<div class="ci">${bedSVG(d.id, 96)}</div>` : d.icon ? `<div class="ci">${decorPic(d, '2.6rem')}</div>` : `<div class="swatch${d.rug ? ' round' : ''}" style="background:${d.css}"></div>`;
      let btn;
      if (!owned) btn = locked ? lockBtn(d) : buyBtn(d);
      else if (d.type === 'item') btn = state.decor.placed.includes(d.id)
        ? `<button class="btn small ghost" data-toggle="${d.id}">Put away</button>`
        : `<button class="btn small blue" data-toggle="${d.id}">Place</button>`;
      else btn = state.decor[d.type] === d.id
        ? '<button class="btn small green" disabled>Using ✓</button>'
        : `<button class="btn small blue" data-use="${d.id}">Use</button>`;
      return `<div class="card ${locked ? 'locked' : ''}">${pic}<div class="cn">${d.name}</div>
        <div class="ce">${d.type === 'bed' ? (d.sleep > 1 ? `Bed · ⚡ +${Math.round((d.sleep - 1) * 100)}% sleep` : 'Bed') : d.rug ? 'Rug' : d.type === 'item' ? 'Furniture' : d.type === 'wall' ? 'Wallpaper' : 'Floor'}</div>${btn}</div>`;
    }).join('');
  }

  // Tie the shop to what the pet needs right now.
  const pet = activePet();
  const need = petNeed(pet);
  const needTab = { hunger: 'food', thirst: 'drink', happiness: 'toys' }[need];
  const needWord = { hunger: 'hungry', thirst: 'thirsty', happiness: 'bored' }[need];
  const have = needTab === 'food' || needTab === 'drink' ? Object.values(state.inv[needTab]).reduce((a, b) => a + b, 0) : state.toys.length;
  const hint = needTab && needTab !== shopTab
    ? `<div class="hint-banner"><span class="hb-pet">${petSVG(pet)}</span><span class="hb-text"><b>${esc(pet.name)} is ${needWord}</b><span>You have ${have} ${needTab === 'toys' ? 'toys' : needTab === 'food' ? 'food items' : 'drinks'}.</span></span><button class="btn small blue" data-sub="${needTab}">Show me</button></div>`
    : '';
  screen.innerHTML = `<h2>Shop</h2>
    ${hint}
    <div class="subtabs">${tabs.map(([id, label]) => `<button data-sub="${id}" class="${shopTab === id ? 'active' : ''}">${label}</button>`).join('')}</div>
    <div class="grid">${cards}</div>`;

  screen.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { shopTab = b.dataset.sub; renderShop(); });
  screen.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(b.dataset.buy));
  screen.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
    const id = b.dataset.toggle, placed = state.decor.placed;
    if (placed.includes(id)) placed.splice(placed.indexOf(id), 1); else placed.push(id);
    save(); renderShop();
  });
  screen.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
    const d = decorById(b.dataset.use);
    state.decor[d.type] = d.id;
    save(); renderShop();
  });
}

function buy(id) {
  let it;
  if (shopTab === 'food' || shopTab === 'drink') it = (shopTab === 'food' ? FOODS : DRINKS).find(x => x.id === id);
  else if (shopTab === 'toys') it = TOYS.find(x => x.id === id);
  else it = decorById(id);
  if (!it || state.coins < it.cost || state.level < it.level) return;
  state.coins -= it.cost;
  if (shopTab === 'food' || shopTab === 'drink') {
    state.inv[shopTab][id] = (state.inv[shopTab][id] || 0) + 1;
    toast(`Bought ${it.icon} ${it.name}!`);
  } else if (shopTab === 'toys') {
    state.toys.push(id);
    toast(`New toy: ${it.icon} ${it.name}!`);
  } else {
    state.decor.owned.push(id);
    if (it.type === 'item') state.decor.placed.push(id); else state.decor[it.type] = id;
    toast(`${it.name} added to your room!`);
  }
  addXP(2);
  save();
  renderShop();
}

/* ---------- Games list ---------- */

const GAMES = {
  catch:   { icon: '🧺', name: 'Treat Catch', desc: 'Catch falling treats, dodge the bombs!', max: 50, run: runCatch },
  memory:  { icon: '🃏', name: 'Memory Match', desc: 'Find all the matching pairs.', max: 64, run: runMemory },
  bubbles: { icon: '🫧', name: 'Bubble Pop', desc: 'Pop as many bubbles as you can.', max: 60, run: runBubbles },
  mole:    { icon: '🕳️', name: 'Pet Pop-Up', desc: 'Tap the pets as they pop out of their holes!', max: 60, level: 10, run: runMole },
  copy:    { icon: '🐾', name: 'Copy Paws', desc: 'Watch the paws light up, then copy the order.', max: 60, level: 20, run: runCopy },
  hop:     { icon: '🏃', name: 'Hop Run', desc: 'Your pet runs! Jump over rocks and grab coins.', max: 80, level: 30, run: runHop },
  snack:   { icon: '🍪', name: 'Snack Time', desc: 'Your pet wants a snack. Tap the right one, fast!', max: 70, level: 40, run: runSnack },
  seek:    { icon: '🎩', name: 'Hide & Seek', desc: 'Your pet hides under a cup. Follow it as the cups shuffle!', max: 75, level: 50, run: runSeek },
  glide:   { icon: '☁️', name: 'Sky Glide', desc: 'Flap through the clouds and grab the stars.', max: 90, level: 60, run: runGlide },
  // Jobs: your pet works a shift. Make what the customer orders, in the right order.
  burger:  { job: true, icon: '🍔', name: 'Burger Diner', desc: 'Stack burgers just the way customers order them.', max: 80, run: r => runJob(r, 'burger') },
  icecream:{ job: true, icon: '🍦', name: 'Ice Cream Shop', desc: 'Scoop the right flavours, then add the topping.', max: 85, level: 8, run: r => runJob(r, 'icecream') },
  pizza:   { job: true, icon: '🍕', name: 'Pizza Place', desc: 'Make the pizza, then pop it in the oven!', max: 95, level: 18, run: r => runJob(r, 'pizza') },
  cafe:    { job: true, icon: '☕', name: 'Cozy Café', desc: 'Mix drinks for a line of thirsty customers.', max: 100, level: 28, run: r => runJob(r, 'cafe') },
  flowers: { job: true, icon: '💐', name: 'Flower Shop', desc: 'Put the flowers in the vase, then tie a ribbon.', max: 80, level: 3, run: r => runJob(r, 'flowers') },
  toys:    { job: true, icon: '🧸', name: 'Toy Shop', desc: 'Pack the toys in a box and wrap the present.', max: 90, level: 13, run: r => runJob(r, 'toys') },
  vet:     { job: true, icon: '🩺', name: 'Pet Vet', desc: 'Make sick pets feel better. Follow the patient chart!', max: 100, level: 23, run: r => runJob(r, 'vet') },
  bakery:  { job: true, icon: '🎂', name: 'Cake Bakery', desc: 'Stack the cake layers and add the candle.', max: 110, level: 35, run: r => runJob(r, 'bakery') },
};

let playView = 'jobs';   // Play page: 'jobs' (Pet Town) or 'games' (Arcade)
const TILE_HUES = [350, 28, 48, 140, 190, 215, 265, 300];

function renderGames() {
  const pet = activePet();
  const tired = pet && (pet.sleeping || pet.energy < GAME_ENERGY_COST);
  const jobs = playView === 'jobs';
  const list = Object.entries(GAMES).filter(([, g]) => !!g.job === jobs).sort(([, a], [, b]) => (a.level || 1) - (b.level || 1));
  const open = list.filter(([, g]) => state.level >= (g.level || 1)).length;
  const tile = ([key, g], i) => {
    const locked = state.level < (g.level || 1);
    const hue = TILE_HUES[i % TILE_HUES.length];
    return `<button type="button" class="ptile ${jobs ? 'shop' : 'arcade'} ${locked ? 'locked' : ''}" style="--hue:${hue}"
        ${locked ? `data-locked="${key}"` : tired ? 'data-sleep="1"' : `data-game="${key}"`} aria-label="${g.name}">
      ${jobs ? '<span class="awning"></span>' : '<span class="marquee">★ ★ ★</span>'}
      <span class="ptile-screen"><span class="ptile-ico">${locked ? '🔒' : g.icon}</span></span>
      <b class="ptile-name">${g.name}</b>
      ${locked ? `<span class="ptile-lock">Opens at Lv ${g.level}</span>${jobs ? `<span class="ptile-pay">💰 Pay x${jobTier(key)}</span>` : ''}`
        : `<span class="ptile-meta"><span class="glvl">Lv ${gameLevel(key)}</span> ⭐ ${state.best[key] || 0}</span>
           <span class="ptile-win">🪙 up to ${maxWin(key)}${!jobs && coinBonus(key) > 1 ? ` <i>x${coinBonus(key)}</i>` : ''}</span>
           ${jobs ? `<span class="ptile-pay">💰 Pay x${Math.round(coinBonus(key) * jobTier(key) * 100) / 100}</span>` : ''}
           <span class="ptile-go">${tired ? '😴 Sleep first' : jobs ? '💼 Work!' : '▶ Play!'}</span>`}
    </button>`;
  };
  screen.innerHTML = `<h2>Play</h2>
    <div class="play-switch">
      <button type="button" data-pv="jobs" class="${jobs ? 'active' : ''}"><span>🏙️</span>Pet Town<small>Jobs</small></button>
      <button type="button" data-pv="games" class="${!jobs ? 'active' : ''}"><span>🕹️</span>Arcade<small>Games</small></button>
    </div>
    ${pet ? `<div class="energy-pill">⚡ ${esc(pet.name)}'s energy: <b>${Math.round(pet.energy)}</b> · each play uses ${GAME_ENERGY_COST}</div>` : ''}
    <div class="play-scene ${jobs ? 'town' : 'arcade'}">
      <div class="play-sign">${jobs ? '🏙️ Pet Town · pick a job!' : '🕹️ Pet Arcade · pick a game!'} <small>${open}/${list.length} open</small></div>
      <div class="ptiles">${list.map(tile).join('')}</div>
    </div>`;
  screen.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { playView = b.dataset.pv; renderGames(); });
  screen.querySelectorAll('[data-game]').forEach(b => b.onclick = () => startGame(b.dataset.game));
  screen.querySelectorAll('[data-locked]').forEach(b => b.onclick = () => { const g = GAMES[b.dataset.locked]; toast(`🔒 ${g.name} opens at level ${g.level}! ${g.desc}`); });
  screen.querySelectorAll('[data-sleep]').forEach(b => b.onclick = () => { go('room'); toast(`Tap Sleep so ${pet.name} can rest! 🌙`); });
}

function startGame(key) {
  const pet = activePet();
  if (state.level < (GAMES[key].level || 1)) { toast(`🔒 ${GAMES[key].name} opens at level ${GAMES[key].level}!`); return; }
  if (!pet) { toast('Hatch an egg first so you have someone to play with!'); return; }
  if (pet.sleeping) { toast(`${pet.name} is sleeping.`); return; }
  if (pet.energy < GAME_ENERGY_COST) { toast(`${pet.name} is too tired. Let them sleep first! 🌙`); return; }
  currentTab = 'play';
  document.querySelectorAll('#nav button').forEach(b => b.classList.remove('active'));
  activeGame = GAMES[key].run(screen);
  $('#gLevel').textContent = `Lv ${gameLevel(key)}`;
  $('#gQuit').onclick = () => go('games');
}

function finishGame(key, score, coins) {
  if (activeGame) { activeGame.stop(); activeGame = null; }
  const pet = activePet();
  const lvl = gameLevel(key), bonus = coinBonus(key);
  const base = Math.max(0, Math.round(coins));
  coins = Math.round(base * bonus);
  state.coins += coins;
  state.stats.coinsEarned += coins;
  const isBest = score > (state.best[key] || 0);
  if (isBest) state.best[key] = score;
  state.plays[key] = (state.plays[key] || 0) + 1;
  if (pet) {
    pet.energy = clamp(pet.energy - GAME_ENERGY_COST);
    pet.happiness = clamp(pet.happiness + 10);
    pet.pxp += 8;
  }
  currentTab = 'games';
  render();
  openModal(`<h2>${GAMES[key].job ? 'Shift over!' : 'Game over!'}</h2>${GAMES[key].job ? `<p>😊 Customers served: <b>${score}</b></p>` : ''}
    <p class="big">⭐ ${score} ${isBest && score > 0 ? '<span class="new-best">New best!</span>' : ''}</p>
    <p class="lvl-done">🏁 Level ${lvl} done! Next time: <b>Level ${lvl + 1}</b></p>
    <p>You earned <b>🪙 ${coins}</b>${bonus > 1 && base > 0 ? ` <span class="muted">(${base} × level bonus ${bonus})</span>` : ''}</p>
    ${pet ? `<p class="muted">${esc(pet.name)} had fun! +10 😊 · −${GAME_ENERGY_COST} ⚡</p>` : ''}
    <button class="btn" data-close>OK</button>`);
  addXP(5 + Math.floor(coins / 3));
  save();
}

// Each finished game moves that game up one level: a tiny bit harder (2% per level, up to 60%)
// and it pays more coins (5% more per level, up to 2.5x).
const gameLevel = key => (state.plays[key] || 0) + 1;
const difficulty = key => 1 + Math.min(state.plays[key] || 0, 30) * 0.02;
// Jobs pay even more: +10% for every shift you've worked there (up to 5x after 40 shifts).
const coinBonus = key => Math.round((GAMES[key] && GAMES[key].job
  ? 1 + Math.min(state.plays[key] || 0, 40) * 0.1
  : 1 + Math.min(state.plays[key] || 0, 30) * 0.05) * 100) / 100;
// Harder jobs (the ones that open at higher player levels) pay more for every order.
const jobTier = key => Math.round((1 + ((GAMES[key] && GAMES[key].level) || 1) / 25) * 100) / 100;
// Highest coins you can earn in one go, with all bonuses.
const maxWin = key => Math.round(GAMES[key].max * coinBonus(key) * (GAMES[key].job ? jobTier(key) : 1));

const gameHead = () => `<div class="game-head">
  <span class="glvl" id="gLevel"></span><span>⏱ <b id="gTime"></b></span><span>⭐ <b id="gScore">0</b></span><span id="gExtra"></span>
  <button class="btn small ghost" id="gQuit">Quit</button></div>`;

/* ---------- Eggs ---------- */

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const speciesIn = regionId => Object.entries(SPECIES).filter(([, s]) => s.region === regionId);

function renderEggs() {
  screen.innerHTML = `<h2>Eggs</h2>
    <h3>Incubator (${state.eggs.length}/${MAX_EGGS})</h3>
    <div class="incubator" id="incubator"></div>
    <div class="egg-board">
      <div class="egg-board-title"><span>✦</span> Regional Egg Collection <span>✦</span></div>
      <div class="egg-grid">${REGIONS.map((r, i) => {
        const locked = state.level < r.level;
        const species = speciesIn(r.id);
        const found = species.filter(([id]) => state.dex.includes(id)).length;
        return `<button class="egg-card ${locked ? 'locked' : ''}" data-region="${r.id}">
          <span class="ec-found">${found}/${species.length}</span>
          <div class="ec-img">${eggSVG(r.id, 64)}</div>
          <div class="ec-num">${ORDINALS[i] || `${i + 1}th`}</div>
          <div class="ec-name">${r.name}</div>
          <div class="ec-egg">${r.eggName}</div>
          <div class="ec-foot">${locked ? `🔒 Lv ${r.level}` : `🪙 ${r.cost}`}</div>
          <span class="ec-corner">${r.emoji}</span>
        </button>`;
      }).join('')}</div>
      <p class="muted center">Tap an egg to see its pets and buy it.</p>
    </div>`;
  screen.querySelectorAll('[data-region]').forEach(b => b.onclick = () => openRegion(b.dataset.region));
  updateIncubator();
}

function rarityGroups(regionId) {
  const species = speciesIn(regionId);
  return RARITY_ORDER.map(rar => {
    const list = species.filter(([, s]) => s.rarity === rar);
    const found = list.filter(([sid]) => state.dex.includes(sid)).length;
    return `<div class="rar-group rar-${rar}">
      <div class="rar-head"><span class="tag" style="background:${RARITY[rar].color}">${RARITY[rar].label}</span>
        <span class="muted">${RARITY[rar].w}% · <b>1 in ${Math.round(100 / RARITY[rar].w).toLocaleString('en-US')} eggs</b> · found ${found}/${list.length}</span></div>
      <div class="rar-grid">${list.map(([sid, sp]) => {
        const known = state.dex.includes(sid);
        return `<div class="book-card ${known ? '' : 'unknown'}" title="${known ? sp.name : 'Not found yet'}">
          ${petSVG({ species: sid, stage: 2, hunger: 80, thirst: 80, happiness: 80, energy: 80 })}
          <span>${known ? sp.name : '???'}</span></div>`;
      }).join('')}</div></div>`;
  }).join('');
}

function openRegion(id) {
  const r = regionById(id);
  const locked = state.level < r.level;
  const full = state.eggs.length >= MAX_EGGS;
  const rows = rarityGroups(r.id);
  openModal(`${eggSVG(r.id, 100)}
    <h2>${r.eggName}</h2>
    <p class="muted">${r.emoji} ${r.name} · Hatches in ${fmtTime(r.hatch)}</p>
    <div class="dex-rows">${rows}</div>
    ${locked ? `<p><b>🔒 Unlocks at level ${r.level}</b></p>` : full ? '<p class="muted">Your incubator is full.</p>' : ''}
    ${locked ? '' : `<button class="btn" id="buyEgg" ${state.coins < r.cost || full ? 'disabled' : ''}>Buy for 🪙 ${r.cost}</button>`}
    <button class="btn ghost" data-close>Close</button>`, box => {
    const b = $('#buyEgg', box);
    if (b) b.onclick = () => { closeModal(); buyEgg(r.id); };
  });
}

function updateIncubator() {
  const box = $('#incubator');
  if (!box) return;
  const now = Date.now();
  let html = state.eggs.map(e => {
    const r = regionById(e.region);
    const left = (e.readyAt - now) / 1000;
    const ready = left <= 0;
    const pct = clamp(100 - left / r.hatch * 100);
    return `<div class="egg-slot ${ready ? 'ready' : ''}">${eggSVG(e.region, 56)}
      <span>${r.eggName}</span>
      ${ready ? `<button class="btn small green" data-hatch="${e.id}">Hatch!</button>`
              : `<div class="bar"><div style="width:${pct}%"></div></div><span class="muted">${fmtTime(left)}</span>`}</div>`;
  }).join('');
  for (let i = state.eggs.length; i < MAX_EGGS; i++) html += `<div class="egg-slot"><span class="muted">Empty slot</span></div>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-hatch]').forEach(b => b.onclick = () => hatch(+b.dataset.hatch));
}

function buyEgg(regionId) {
  const r = regionById(regionId);
  if (state.coins < r.cost || state.eggs.length >= MAX_EGGS || state.level < r.level) return;
  state.coins -= r.cost;
  state.eggs.push({ id: state.nextEgg++, region: r.id, readyAt: Date.now() + r.hatch * 1000 });
  toast(`You got a ${r.eggName}!`);
  addXP(5);
  save();
  renderEggs();
}

function hatch(eggId) {
  const egg = state.eggs.find(e => e.id === eggId);
  if (!egg || egg.readyAt > Date.now()) return;
  state.eggs = state.eggs.filter(e => e.id !== eggId);
  const options = Object.entries(SPECIES).filter(([, s]) => s.region === egg.region);
  // First roll the rarity with the egg odds, then pick one pet of that rarity.
  const tier = weighted(RARITY_ORDER, r => RARITY[r].w);
  const inTier = options.filter(([, s]) => s.rarity === tier);
  const [speciesId, sp] = inTier[Math.floor(Math.random() * inTier.length)];
  const pet = {
    id: state.nextId++, species: speciesId, name: sp.name, stage: 0, pxp: 0,
    hunger: 80, thirst: 80, happiness: 90, energy: 90, sleeping: false, born: Date.now(),
  };
  state.pets.push(pet);
  const isNew = !state.dex.includes(speciesId);
  if (isNew) state.dex.push(speciesId);
  state.stats.hatched++;
  if (!activePet()) state.activeId = pet.id;
  save();
  render();
  const heading = { divine: '🌈 DIVINE!! 🌈', legendary: '⭐ LEGENDARY! ⭐', rare: '💜 Rare!' }[sp.rarity] || '🐣 It hatched!';
  openModal(`<h2>${heading}</h2>
    <div class="big-pet">${petSVG(pet, { mood: 'happy' })}</div>
    <p>A baby <b>${sp.name}</b>! <span class="tag" style="background:${RARITY[sp.rarity].color}">${RARITY[sp.rarity].label}</span>
      ${isNew ? '<br><span class="muted">New species discovered!</span>' : ''}</p>
    <p class="muted">Give your new pet a name:</p>
    <input id="petName" maxlength="14" value="${esc(sp.name)}">
    <br><button class="btn" id="nameOk">Welcome home!</button>`, box => {
    const input = $('#petName', box);
    input.select();
    const done = () => {
      pet.name = input.value.trim() || sp.name;
      closeModal(); save(); render();
    };
    $('#nameOk', box).onclick = done;
    input.onkeydown = e => { if (e.key === 'Enter') done(); };
  });
  addXP(RARITY[sp.rarity].xp);
}

/* ---------- Pets ---------- */

let petsView = 'mine';
let petSort = 'high';   // My Pets order: high, rare or region
let bookRegion = 'grass';

function renderPetBook() {
  const total = Object.keys(SPECIES).length;
  const r = regionById(bookRegion);
  const inRegion = speciesIn(r.id);
  const found = inRegion.filter(([id]) => state.dex.includes(id)).length;
  return `<p class="muted center">You've found ${state.dex.length} of ${total} pets. Hatch eggs to fill your book!</p>
    <div class="subtabs region-tabs">${REGIONS.map(x => `<button data-book="${x.id}" class="${x.id === bookRegion ? 'active' : ''}">${x.emoji} ${x.name}</button>`).join('')}</div>
    <div class="book-head">${eggSVG(r.id, 48)}<div><b>${r.name}</b><div class="muted">${r.eggName} · found ${found}/${inRegion.length}</div></div></div>
    ${rarityGroups(r.id)}`;
}

/* ---------- Profile ---------- */
// The picture on your profile: the pet you picked, else your favourite pet, else your active pet.
function profileAvatar() {
  const pr = state.profile || {};
  if (pr.avatar && SPECIES[pr.avatar]) return pr.avatar;
  const fav = state.pets.find(p => p.id === pr.fav) || activePet();
  return fav ? fav.species : null;
}
const PLAYER_TITLES = [[1, 'Pet Pal'], [5, 'Pet Helper'], [15, 'Pet Keeper'], [30, 'Pet Expert'], [50, 'Pet Master'], [80, 'Pet Hero'], [120, 'Pet Legend'], [150, 'Pet Royalty']];
const playerTitle = () => PLAYER_TITLES.filter(([l]) => state.level >= l).pop()[1];
const gamesPlayed = () => Object.values(state.plays).reduce((a, b) => a + b, 0);
const ownsRarity = r => state.pets.some(p => SPECIES[p.species].rarity === r);
const BADGES = [
  { icon: '🥚', name: 'First Friend',    how: 'Hatch your first pet',         got: () => state.pets.length >= 1 },
  { icon: '🏡', name: 'Pet Family',      how: 'Have 5 pets',                  got: () => state.pets.length >= 5 },
  { icon: '🌱', name: 'All Grown Up',    how: 'Raise a pet to Adult',         got: () => state.pets.some(p => p.stage >= 2) },
  { icon: '📖', name: 'Collector',       how: 'Find 25 pets in the Pet Book', got: () => state.dex.length >= 25 },
  { icon: '📚', name: 'Super Collector', how: 'Find 75 pets in the Pet Book', got: () => state.dex.length >= 75 },
  { icon: '💎', name: 'Rare Find',       how: 'Own a Rare pet',               got: () => ownsRarity('rare') },
  { icon: '👑', name: 'Legend Keeper',   how: 'Own a Legendary pet',          got: () => ownsRarity('legendary') },
  { icon: '✨', name: 'Divine Blessing', how: 'Own a Divine pet',             got: () => ownsRarity('divine') },
  { icon: '🗺️', name: 'Explorer',        how: 'Open 5 egg regions',           got: () => REGIONS.filter(r => state.level >= r.level).length >= 5 },
  { icon: '🍎', name: 'Good Carer',      how: 'Give 50 snacks or drinks',     got: () => state.stats.fed + state.stats.drinks >= 50 },
  { icon: '🎮', name: 'Gamer',           how: 'Play 25 minigames',            got: () => gamesPlayed() >= 25 },
  { icon: '🏆', name: 'Pro Gamer',       how: 'Play 100 minigames',           got: () => gamesPlayed() >= 100 },
  { icon: '🛋️', name: 'Decorator',       how: 'Own 10 room items',            got: () => state.decor.owned.length >= 13 },
  { icon: '⭐', name: 'Level 10',        how: 'Reach level 10',               got: () => state.level >= 10 },
  { icon: '🌟', name: 'Level 50',        how: 'Reach level 50',               got: () => state.level >= 50 },
  { icon: '💫', name: 'Level 100',       how: 'Reach level 100',              got: () => state.level >= 100 },
  { icon: '👨‍👩‍👧', name: 'Big Family',     how: 'Have 15 pets',                 got: () => state.pets.length >= 15 },
  { icon: '🏅', name: 'Pet Book Hero',   how: 'Find every pet in the Pet Book', got: () => state.dex.length >= Object.keys(SPECIES).length },
  { icon: '🍰', name: 'Snack Master',    how: 'Give 200 snacks',              got: () => state.stats.fed >= 200 },
  { icon: '🧃', name: 'Drink Buddy',     how: 'Give 100 drinks',              got: () => state.stats.drinks >= 100 },
  { icon: '🧸', name: 'Play Pal',        how: 'Play with toys 50 times',      got: () => state.stats.toys >= 50 },
  { icon: '🪙', name: 'Piggy Bank',      how: 'Earn 1,000 coins in games',    got: () => state.stats.coinsEarned >= 1000 },
  { icon: '💰', name: 'Treasure Hunter', how: 'Earn 10,000 coins in games',   got: () => state.stats.coinsEarned >= 10000 },
  { icon: '🎯', name: 'High Scorer',     how: 'Score 30 in any game',         got: () => Object.values(state.best).some(v => v >= 30) },
  { icon: '🚀', name: 'Game Climber',    how: 'Reach game level 10',          got: () => Object.values(state.plays).some(v => v >= 9) },
  { icon: '🌋', name: 'Game Champion',   how: 'Reach game level 25',          got: () => Object.values(state.plays).some(v => v >= 24) },
  { icon: '🕹️', name: 'All-Rounder',     how: 'Play every open minigame',     got: () => Object.entries(GAMES).filter(([, g]) => state.level >= (g.level || 1)).every(([k]) => state.plays[k] > 0) },
  { icon: '🎨', name: 'Room Designer',   how: 'Own 5 walls or floors',        got: () => state.decor.owned.filter(id => { const d = decorById(id); return d && (d.type === 'wall' || d.type === 'floor'); }).length >= 5 },
  { icon: '🛏️', name: 'Comfy Sleeper',   how: 'Own 3 beds',                   got: () => state.decor.owned.filter(id => { const d = decorById(id); return d && d.type === 'bed'; }).length >= 3 },
  ...REGIONS.map(r => ({ icon: r.emoji, name: `${r.name} Friend`, how: `Find 5 ${r.name} pets`,
    got: () => state.dex.filter(id => SPECIES[id] && SPECIES[id].region === r.id).length >= 5 })),
];
const rarityName = r => r[0].toUpperCase() + r.slice(1);

function renderProfile() {
  const pr = state.profile;
  const av = profileAvatar();
  const fav = state.pets.find(p => p.id === pr.fav);
  const earned = BADGES.filter(b => b.got()).length;
  const joined = new Date(pr.joined).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const stat = (icon, label, value) => `<div class="pstat"><span class="pi">${icon}</span><b>${value}</b><small>${label}</small></div>`;
  screen.innerHTML = `
    <h2>My Profile</h2>
    <div class="profile-card">
      <button class="pavatar" id="pickAvatar" type="button" title="Change picture">
        ${av ? `<img src="${SPECIES[av].img}" alt="">` : '<span>🐾</span>'}<i>✏️</i>
      </button>
      <div class="pinfo">
        <div class="pname"><b>${esc(pr.name)}</b><button class="pedit" id="editName" type="button" aria-label="Change name">✏️</button></div>
        <div class="ptitle">🎀 ${playerTitle()}</div>
        <div class="plevel"><span class="lv-badge small">${state.level}</span><div class="bar xp"><div class="fill" style="width:${state.xp / xpNeed(state.level) * 100}%"></div></div></div>
        <div class="muted">Playing since ${joined}</div>
      </div>
    </div>

    <h3 class="psub">💖 Favourite Pet</h3>
    <div class="pfav">
      ${fav ? `<img src="${SPECIES[fav.species].img}" alt=""><div class="pfav-t"><b>${esc(fav.name)}</b><div class="muted">${STAGES[fav.stage]} ${SPECIES[fav.species].name} · ${rarityName(SPECIES[fav.species].rarity)}</div></div>`
            : `<div class="pfav-t muted">Pick the pet you love most!</div>`}
      <button class="btn small" id="pickFav" type="button" ${state.pets.length ? '' : 'disabled'}>${fav ? 'Change' : 'Pick'}</button>
    </div>

    <h3 class="psub">📊 My Stats</h3>
    <div class="pstats">
      ${stat('🐾', 'Pets', state.pets.length)}
      ${stat('📖', 'Pet Book', `${state.dex.length}/${Object.keys(SPECIES).length}`)}
      ${stat('🥚', 'Eggs hatched', Math.max(state.stats.hatched, state.pets.length))}
      ${stat('🎮', 'Games played', gamesPlayed())}
      ${stat('🍎', 'Snacks given', state.stats.fed)}
      ${stat('🥤', 'Drinks given', state.stats.drinks)}
      ${stat('⚽', 'Playtimes', state.stats.toys)}
      ${stat('🪙', 'Coins earned', state.stats.coinsEarned)}
    </div>

    <div id="friendsBox"></div>

    <button class="btn ghost small switch-player" id="switchPlayer" type="button">🔁 Switch player</button>

    <h3 class="psub">🏅 Badges <span class="muted">${earned}/${BADGES.length}</span></h3>
    <div class="pbadges">
      ${BADGES.map(b => `<div class="pbadge ${b.got() ? 'got' : ''}" title="${b.how}"><span>${b.got() ? b.icon : '🔒'}</span><b>${b.name}</b><small>${b.how}</small></div>`).join('')}
    </div>`;

  if (window.renderFriends) window.renderFriends();
  if (window.PETPALS_ONLINE_ON) $('#switchPlayer').textContent = '🚪 Log out';
  $('#switchPlayer').onclick = () => {
    save();
    if (window.PETPALS_ONLINE_ON && window.PPO) { window.PPO.logout(); return; }
    try { sessionStorage.removeItem('petpals-current'); sessionStorage.removeItem('petpals-sandbox-current'); } catch (e) { /* ignore */ }
    location.href = location.pathname + (location.search.includes('sandbox=login') ? '?sandbox=login' : '');        // back to the "Who's playing?" screen
  };
  $('#editName').onclick = () => openModal(`<h2>Your name</h2>
      <input id="nameInput" maxlength="16" value="${esc(pr.name)}" style="width:100%;font-size:1.1rem;padding:10px;border-radius:12px;border:2px solid;margin-bottom:10px">
      <button class="btn" id="saveName">Save</button> <button class="btn ghost small" data-close>Cancel</button>`, box => {
    const inp = $('#nameInput', box); inp.focus(); inp.select();
    const ok = () => { const v = inp.value.trim().slice(0, 16); if (v) { state.profile.name = v; save(); } closeModal(); render(); };
    $('#saveName', box).onclick = ok;
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  });
  $('#pickAvatar').onclick = () => openModal(`<h2>Profile picture</h2><p class="muted">Pick any pet you've found.</p>
      <div class="avatar-grid">${state.dex.map(id => `<button class="av-pick ${id === av ? 'on' : ''}" data-av="${id}" title="${SPECIES[id].name}"><img src="${SPECIES[id].img}" alt=""></button>`).join('') || '<p>Hatch a pet first!</p>'}</div>
      <button class="btn ghost small" data-close>Close</button>`, box => {
    box.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { state.profile.avatar = b.dataset.av; save(); closeModal(); render(); });
  });
  $('#pickFav').onclick = () => openModal(`<h2>Favourite pet</h2>
      <div class="avatar-grid">${state.pets.map(p => `<button class="av-pick ${p.id === pr.fav ? 'on' : ''}" data-fav="${p.id}" title="${esc(p.name)}"><img src="${SPECIES[p.species].img}" alt=""><small>${esc(p.name)}</small></button>`).join('')}</div>
      <button class="btn ghost small" data-close>Close</button>`, box => {
    box.querySelectorAll('[data-fav]').forEach(b => b.onclick = () => { state.profile.fav = +b.dataset.fav; save(); closeModal(); render(); });
  });
}

/* ---------- Trade codes ----------
   Send a pet to a friend on another computer or iPad: the game turns the pet into a short code
   (like PET-7KQ2M-9XAB4), the pet leaves your game, and your friend types the code into their game.
   A code holds the kind of pet, how grown up it is, a random number (so each code is different)
   and a check number that catches typing mistakes and made-up codes. */
const CODE_ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';          // no I, L, O, U: easy to read and type
const SPECIES_IDS = Object.keys(SPECIES);
const codeMask = nonce => BigInt((Math.imul(Number(nonce) + 7919, 2654435761) >>> 12) & 1048575);
const codeCheck = n => { let h = 2166136261; for (const ch of 'pals:' + n.toString(36)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h & 1023; };

function makeTradeCode(pet) {
  const sIdx = BigInt(SPECIES_IDS.indexOf(pet.species));
  const stage = BigInt(pet.stage);
  const xp = BigInt(Math.min(1023, Math.floor(pet.pxp / 10)));
  const nonce = BigInt(Math.floor(Math.random() * 1048576));
  const high = ((sIdx << 12n) | (stage << 10n) | xp) ^ codeMask(nonce);   // 20 bits, mixed so codes look random
  const body = (high << 20n) | nonce;                                      // 40 bits
  const n = (body << 10n) | BigInt(codeCheck(body));                       // + 10-bit check = 50 bits
  let s = '';
  for (let i = 0; i < 10; i++) s = CODE_ABC[Number((n >> BigInt(i * 5)) & 31n)] + s;
  return `PET-${s.slice(0, 5)}-${s.slice(5)}`;
}

function readTradeCode(code) {
  const t = String(code).toUpperCase().replace(/^PET/, '').replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1');                              // forgive easy mix-ups
  if (t.length !== 10) return null;
  let n = 0n;
  for (const ch of t) { const v = CODE_ABC.indexOf(ch); if (v < 0) return null; n = (n << 5n) | BigInt(v); }
  const body = n >> 10n;
  if (Number(n & 1023n) !== codeCheck(body)) return null;
  const high = (body >> 20n) ^ codeMask(body & 1048575n);
  const sIdx = Number(high >> 12n), stage = Number((high >> 10n) & 3n), xp = Number(high & 1023n) * 10;
  const species = SPECIES_IDS[sIdx];
  if (!species || stage > 2) return null;
  return { species, stage, pxp: Math.max(xp, EVOLVE_AT[stage]), key: t };
}

function openSendPet() {
  if (state.pets.length < 2) { toast('Keep at least one pet! Hatch another egg before sending one away.'); return; }
  openModal(`<h2>🎁 Send a pet</h2><p class="muted">Pick the pet to send to a friend. It will leave your game and become a code.</p>
    <div class="avatar-grid">${state.pets.map(p => `<button class="av-pick" data-send="${p.id}"><img src="${SPECIES[p.species].img}" alt=""><small>${esc(p.name)}</small></button>`).join('')}</div>
    <button class="btn ghost small" data-close>Cancel</button>`, box => {
    box.querySelectorAll('[data-send]').forEach(b => b.onclick = () => {
      const pet = state.pets.find(p => p.id === +b.dataset.send);
      closeModal();
      setTimeout(() => openModal(`<h2>Send ${esc(pet.name)}?</h2>
        <img src="${SPECIES[pet.species].img}" alt="" style="width:120px;height:120px;object-fit:contain">
        <p>${esc(pet.name)} will <b>leave your game</b> and turn into a code for your friend. This can't be undone!</p>
        <button class="btn" id="sendYes">Yes, make the code</button> <button class="btn ghost small" data-close>No, keep ${esc(pet.name)}</button>`, box2 => {
        $('#sendYes', box2).onclick = () => {
          const code = makeTradeCode(pet);
          state.pets = state.pets.filter(p => p !== pet);
          if (state.activeId === pet.id) state.activeId = state.pets[0].id;
          if (state.profile && state.profile.fav === pet.id) state.profile.fav = null;
          (state.sentCodes = state.sentCodes || []).push({ code, species: pet.species, name: pet.name, at: Date.now() });
          save();
          closeModal();
          showCode(pet, code);
          render();
        };
      }), 50);
    });
  });
}

function showCode(pet, code) {
  openModal(`<h2>📮 Your trade code</h2>
    <p>Give this code to your friend. They type it in <b>Pets → Get a pet</b>.</p>
    <div class="trade-code" id="tcode">${code}</div>
    <p class="muted">${esc(pet.name)} the ${SPECIES[pet.species].name} is waiting inside! Write the code down. You can also find it later under "My sent codes".</p>
    <button class="btn blue small" id="copyCode">📋 Copy</button> <button class="btn" data-close>Done</button>`, box => {
    $('#copyCode', box).onclick = () => { try { navigator.clipboard.writeText(code).then(() => toast('Copied!')); } catch (e) { toast('Write it down!'); } };
  });
}

function openGetPet() {
  openModal(`<h2>📬 Get a pet</h2><p class="muted">Type the code your friend gave you.</p>
    <input id="codeIn" class="code-in" placeholder="PET-XXXXX-XXXXX" maxlength="17" autocomplete="off" autocapitalize="characters" spellcheck="false">
    <p class="code-err" id="codeErr"></p>
    <button class="btn" id="codeGo">Get my pet!</button> <button class="btn ghost small" data-close>Cancel</button>`, box => {
    const inp = $('#codeIn', box); inp.focus();
    const go = () => {
      const r = readTradeCode(inp.value);
      const err = $('#codeErr', box);
      if (!r) { err.textContent = "Hmm, that code doesn't work. Check each letter and try again!"; inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 450); return; }
      state.usedCodes = state.usedCodes || [];
      if (state.usedCodes.includes(r.key) || (state.sentCodes || []).some(c => c.code.replace(/[^0-9A-Z]/g, '').slice(3) === r.key)) { err.textContent = 'This code was already used in this game.'; return; }
      state.usedCodes.push(r.key);
      const sp = SPECIES[r.species];
      const pet = { id: state.nextId++, species: r.species, name: sp.name, stage: r.stage, pxp: r.pxp,
        hunger: 80, thirst: 80, happiness: 95, energy: 90, sleeping: false, born: Date.now() };
      state.pets.push(pet);
      if (!state.dex.includes(r.species)) state.dex.push(r.species);
      if (!state.activeId) state.activeId = pet.id;
      save();
      closeModal();
      openModal(`<h2>🎉 New friend!</h2><img src="${sp.img}" alt="" style="width:150px;height:150px;object-fit:contain">
        <p>A ${STAGES[r.stage]} <b>${sp.name}</b> came to live with you!</p>
        <p class="muted">${RARITY[sp.rarity].label} · ${regionById(sp.region).emoji} ${regionById(sp.region).name}</p>
        <button class="btn" data-close>Yay! 💖</button>`);
      render();
    };
    $('#codeGo', box).onclick = go;
    inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  });
}

function openSentCodes() {
  const list = (state.sentCodes || []).slice().reverse();
  openModal(`<h2>📮 My sent codes</h2>
    ${list.length ? list.map(c => `<div class="sent-code"><img src="${SPECIES[c.species].img}" alt=""><div><b>${esc(c.name)}</b><div class="trade-code small">${c.code}</div></div></div>`).join('') : '<p class="muted">You haven\'t sent any pets yet.</p>'}
    <button class="btn" data-close>Close</button>`);
}

// Say goodbye to a pet. It goes back to the wild and leaves a small thank-you gift
// (always less than its egg cost, so releasing never makes money).
const RELEASE_GIFT = { common: 0.1, uncommon: 0.15, rare: 0.2, legendary: 0.4, divine: 0.8 };
function releasePet(id) {
  const pet = state.pets.find(p => p.id === id);
  if (!pet || state.pets.length < 2) return;
  const sp = SPECIES[pet.species], reg = regionById(sp.region);
  const gift = Math.round(reg.cost * RELEASE_GIFT[sp.rarity]);
  const rareWarn = ['legendary', 'divine'].includes(sp.rarity)
    ? `<p><b>⚠️ ${esc(pet.name)} is ${RARITY[sp.rarity].label}! Are you really sure?</b></p>` : '';
  openModal(`<h2>Release ${esc(pet.name)}?</h2>
    <img src="${sp.img}" alt="" style="width:120px;height:120px;object-fit:contain">
    <p>${esc(pet.name)} will go back to ${reg.emoji} ${reg.name} and live happily in the wild.
    You can't get ${esc(pet.name)} back.</p>${rareWarn}
    <p>${esc(pet.name)} leaves you a thank-you gift of 🪙 ${gift}.</p>
    <button class="btn" id="relYes">👋 Yes, release</button> <button class="btn ghost" data-close>No, keep ${esc(pet.name)}</button>`, box => {
    $('#relYes', box).onclick = () => {
      state.pets = state.pets.filter(p => p !== pet);
      if (state.activeId === pet.id) state.activeId = state.pets[0].id;
      if (state.profile && state.profile.fav === pet.id) state.profile.fav = null;
      state.coins += gift;
      save();
      closeModal();
      toast(`👋 Bye bye, ${pet.name}! You got 🪙 ${gift}.`);
      render();
    };
  });
}

function renderPets() {
  const tabs = `<div class="subtabs"><button data-view="mine" class="${petsView === 'mine' ? 'active' : ''}">🐾 My Pets</button><button data-view="book" class="${petsView === 'book' ? 'active' : ''}">📖 Pet Book</button></div>`;
  if (petsView === 'book') {
    screen.innerHTML = `<h2>Pet Book</h2>${tabs}${renderPetBook()}`;
    screen.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { petsView = b.dataset.view; renderPets(); });
    screen.querySelectorAll('[data-book]').forEach(b => b.onclick = () => { bookRegion = b.dataset.book; renderPets(); });
    return;
  }
  const card = p => {
      const sp = SPECIES[p.species];
      const active = p.id === state.activeId;
      const next = p.stage < 2 ? EVOLVE_AT[p.stage + 1] : null;
      const pct = next ? clamp((p.pxp - EVOLVE_AT[p.stage]) / (next - EVOLVE_AT[p.stage]) * 100) : 100;
      return `<div class="pet-card ${active ? 'active' : ''}">
        <div class="mini">${petSVG(p)}</div>
        <div class="pinfo"><b>${esc(p.name)}</b> <span class="tag" style="background:${RARITY[sp.rarity].color}">${RARITY[sp.rarity].label}</span>
          <div class="muted">${STAGES[p.stage]} ${sp.name} · ${regionById(sp.region).emoji}${p.sleeping ? ' · 💤' : ''}</div>
          <div class="muted">${STAT_INFO.map(s => `${s.icon}${Math.round(p[s.key])}`).join(' ')}</div>
          <div class="bar"><div style="width:${pct}%"></div></div>
        </div>
        <div class="pbtns">
          ${active ? '<button class="btn small green" disabled>In room</button>' : `<button class="btn small blue" data-active="${p.id}">Bring to room</button>`}
          <button class="btn small ghost" data-rename="${p.id}">Rename</button>
          ${state.pets.length > 1 ? `<button class="btn small ghost release-btn" data-release="${p.id}">👋 Release</button>` : ''}
        </div></div>`;
  };
  // Highest first: grown-up stage, then most growing points, then rarest.
  const rank = p => RARITY_ORDER.indexOf(SPECIES[p.species].rarity);
  const byHigh = (a, b) => b.stage - a.stage || b.pxp - a.pxp || rank(b) - rank(a);
  const byRare = (a, b) => rank(b) - rank(a) || byHigh(a, b);
  let list = '';
  if (!state.pets.length) list = '<div class="panel">No pets yet. Go hatch an egg! 🥚</div>';
  else if (petSort === 'region') {
    list = REGIONS.map(r => {
      const mine = state.pets.filter(p => SPECIES[p.species].region === r.id).sort(byHigh);
      return mine.length ? `<h3 class="sort-head">${r.emoji} ${r.name} <span class="muted">(${mine.length})</span></h3>${mine.map(card).join('')}` : '';
    }).join('');
  } else list = [...state.pets].sort(petSort === 'rare' ? byRare : byHigh).map(card).join('');
  const sortBtn = (k, label) => `<button data-sort="${k}" class="${petSort === k ? 'active' : ''}">${label}</button>`;
  screen.innerHTML = `<h2>My Pets</h2>${tabs}
    <p class="muted">You have <b>${state.pets.length}</b> pets. Pets that aren't in your room get hungry more slowly.</p>
    ${state.pets.length > 1 ? `<div class="subtabs sortbar">${sortBtn('high', '⬆️ Highest')}${sortBtn('rare', '💎 Rarest')}${sortBtn('region', '🗺️ Region')}</div>` : ''}
    ${list}
    <p style="text-align:center"><button class="linkbtn" id="reset">Start a new game</button></p>`;

  screen.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { petSort = b.dataset.sort; renderPets(); });
  screen.querySelectorAll('[data-release]').forEach(b => b.onclick = () => releasePet(+b.dataset.release));

  screen.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { petsView = b.dataset.view; renderPets(); });
  screen.querySelectorAll('[data-active]').forEach(b => b.onclick = () => {
    state.activeId = +b.dataset.active; save(); go('room');
  });
  screen.querySelectorAll('[data-rename]').forEach(b => b.onclick = () => {
    const pet = state.pets.find(p => p.id === +b.dataset.rename);
    openModal(`<h2>Rename</h2><input id="rn" maxlength="14" value="${esc(pet.name)}"><br>
      <button class="btn" id="rnOk">Save</button> <button class="btn ghost" data-close>Cancel</button>`, box => {
      const input = $('#rn', box); input.select();
      const done = () => { pet.name = input.value.trim() || pet.name; closeModal(); save(); renderPets(); };
      $('#rnOk', box).onclick = done;
      input.onkeydown = e => { if (e.key === 'Enter') done(); };
    });
  });
  $('#reset').onclick = () => {
    openModal(`<h2>Start over?</h2><p>This deletes all your pets, coins and decorations.</p>
      <button class="btn" id="resetYes">Yes, start over</button> <button class="btn ghost" data-close>Keep playing</button>`, box => {
      $('#resetYes', box).onclick = () => { state = newState(); save(); closeModal(); go('room'); };
    });
  };
}

/* ======================== MINIGAMES ======================== */

// Treat Catch: move a basket to catch falling treats.
function runCatch(root) {
  root.innerHTML = gameHead() + `<canvas id="gc" width="360" height="460"></canvas>
    <p class="hint">Move with your mouse, finger, or ← → keys. Catch treats, dodge 💣!</p>`;
  const cv = $('#gc', root), ctx = cv.getContext('2d'), W = 360, H = 460;
  const d = difficulty('catch');
  const TYPES = [
    { e: '🍎', p: 1, w: 40 }, { e: '🍓', p: 1, w: 30 }, { e: '🪙', p: 3, w: 14 },
    { e: '⭐', p: 5, w: 6 }, { e: '💣', bomb: true, w: 20 * d },
  ];
  let x = W / 2, score = 0, lives = 3, time = 30, items = [], spawn = 0, flash = 0, raf = 0;
  let last = performance.now();
  const keys = {};
  const move = e => { const r = cv.getBoundingClientRect(); x = (e.clientX - r.left) / r.width * W; };
  const kd = e => { keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); };
  const ku = e => { keys[e.key] = false; };
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerdown', move);
  addEventListener('keydown', kd);
  addEventListener('keyup', ku);

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    time -= dt;
    if (keys.ArrowLeft || keys.a || keys.A) x -= 340 * dt;
    if (keys.ArrowRight || keys.d || keys.D) x += 340 * dt;
    x = clamp(x, 28, W - 28);

    spawn -= dt;
    if (spawn <= 0) {
      const elapsed = 30 - time;
      spawn = Math.max(0.25, (0.75 - elapsed * 0.012) / d);
      const ty = weighted(TYPES, o => o.w);
      items.push({ ...ty, x: 24 + Math.random() * (W - 48), y: -24, vy: (130 + Math.random() * 70 + elapsed * 5) * d });
    }
    for (const it of items) {
      it.y += it.vy * dt;
      if (!it.hit && it.y > H - 72 && it.y < H - 24 && Math.abs(it.x - x) < 36) {
        it.hit = true;
        if (it.bomb) { lives--; flash = 0.35; } else score += it.p;
      }
    }
    items = items.filter(it => !it.hit && it.y < H + 30);
    flash = Math.max(0, flash - dt);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#bfe8ff'); g.addColorStop(1, '#e9fbe0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fd46a'; ctx.fillRect(0, H - 22, W, 22);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '30px serif';
    for (const it of items) ctx.fillText(it.e, it.x, it.y);
    ctx.font = '46px serif';
    ctx.fillText('🧺', x, H - 46);
    if (flash > 0) { ctx.fillStyle = `rgba(255,60,60,${flash})`; ctx.fillRect(0, 0, W, H); }

    $('#gTime', root).textContent = Math.max(0, Math.ceil(time));
    $('#gScore', root).textContent = score;
    $('#gExtra', root).textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(3 - Math.max(0, lives));

    if (time <= 0 || lives <= 0) { finishGame('catch', score, score); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); } };
}

// Memory Match: flip cards to find pairs.
function runMemory(root) {
  const syms = shuffle(['🍎', '🍞', '🐟', '🍰', '🧃', '🥛', '🧸', '⚽']).slice(0, 6);
  const deck = shuffle([...syms, ...syms]);
  root.innerHTML = gameHead() + `<div class="mem-grid">${deck.map((s, i) => `<button class="mem-card" data-i="${i}"><span>${s}</span></button>`).join('')}</div>
    <p class="hint">Find all the matching pairs before time runs out!</p>`;
  let first = null, lock = false, matches = 0, moves = 0, ended = false;
  let time = Math.max(35, 60 - (state.plays.memory || 0));   // one second less each round
  const hud = () => {
    $('#gTime', root).textContent = time;
    $('#gScore', root).textContent = `${matches}/6`;
    $('#gExtra', root).textContent = `Moves: ${moves}`;
  };
  hud();
  const timer = setInterval(() => { time--; hud(); if (time <= 0) end(); }, 1000);
  function end() {
    if (ended) return;
    ended = true;
    clearInterval(timer);
    const won = matches === 6;
    finishGame('memory', matches * 10 + (won ? time : 0), matches * 4 + (won ? 10 + Math.ceil(time / 2) : 0));
  }
  root.querySelectorAll('.mem-card').forEach(c => c.onclick = () => {
    if (lock || ended || c.classList.contains('open')) return;
    c.classList.add('open');
    if (!first) { first = c; return; }
    moves++;
    if (deck[first.dataset.i] === deck[c.dataset.i]) {
      first.classList.add('done'); c.classList.add('done');
      first = null; matches++;
      if (matches === 6) setTimeout(end, 500);
    } else {
      lock = true;
      const f = first; first = null;
      setTimeout(() => { f.classList.remove('open'); c.classList.remove('open'); lock = false; }, 700);
    }
    hud();
  });
  return { stop() { ended = true; clearInterval(timer); } };
}

// Bubble Pop: tap rising bubbles.
function runBubbles(root) {
  root.innerHTML = gameHead() + `<div class="bubble-area" id="ba"></div>
    <p class="hint">Pop the bubbles! Golden ones are worth 5.</p>`;
  const area = $('#ba', root);
  const d = difficulty('bubbles');
  let score = 0, time = 20, spawn = 0, raf = 0, bubbles = [];
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    time -= dt; spawn -= dt;
    const h = area.clientHeight, w = area.clientWidth;
    if (spawn <= 0) {
      spawn = 0.3 + Math.random() * 0.3;
      const size = (40 + Math.random() * 36) / (1 + (d - 1) / 2), gold = Math.random() < 0.12;
      const el = document.createElement('div');
      el.className = 'bubble' + (gold ? ' gold' : '');
      el.style.width = el.style.height = size + 'px';
      const b = { el, y: h, vy: (70 + Math.random() * 80 + (20 - time) * 5) * d, size, wob: Math.random() * 6, popped: false };
      el.style.left = Math.random() * (w - size) + 'px';
      el.addEventListener('pointerdown', () => {
        if (b.popped) return;
        b.popped = true;
        score += gold ? 5 : 1;
        el.classList.add('pop');
        setTimeout(() => el.remove(), 200);
      });
      area.appendChild(el);
      bubbles.push(b);
    }
    for (const b of bubbles) {
      if (b.popped) continue;
      b.y -= b.vy * dt; b.wob += dt * 3;
      b.el.style.transform = `translate(${Math.sin(b.wob) * 8}px, ${b.y}px)`;
      if (b.y < -b.size) { b.popped = true; b.el.remove(); }
    }
    bubbles = bubbles.filter(b => !b.popped);
    $('#gTime', root).textContent = Math.max(0, Math.ceil(time));
    $('#gScore', root).textContent = score;
    if (time <= 0) { finishGame('bubbles', score, score); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); } };
}


// Pet Pop-Up: tap pets that pop out of holes. Don't tap the bombs!
function runMole(root) {
  const d = difficulty('mole');
  root.innerHTML = gameHead() + `<div class="mole-grid" id="mg">${Array.from({ length: 9 }, (_, i) =>
    `<button class="hole" data-i="${i}" type="button" aria-label="Hole ${i + 1}"><span class="critter"></span></button>`).join('')}</div>
    <p class="hint">Tap the pets when they pop up! Don't tap the 💣.</p>`;
  const holes = [...root.querySelectorAll('.hole')];
  const known = state.dex.filter(id => SPECIES[id] && SPECIES[id].img);
  const pool = (known.length >= 3 ? known : ['sprout', 'puff', 'bubbl', 'cinder', 'flurr', 'gummy']).map(id => SPECIES[id].img);
  let score = 0, time = 30, ended = false;
  const timers = [];
  const hud = () => {
    $('#gTime', root).textContent = Math.max(0, time);
    $('#gScore', root).textContent = score;
    $('#gExtra', root).textContent = '';
  };
  function spawn() {
    if (ended) return;
    const free = holes.filter(h => !h.classList.contains('up'));
    if (free.length) {
      const h = free[Math.floor(Math.random() * free.length)];
      const bomb = Math.random() < 0.15 * d;
      h.dataset.kind = bomb ? 'bomb' : 'pet';
      h.querySelector('.critter').innerHTML = bomb ? '💣' : `<img src="${pool[Math.floor(Math.random() * pool.length)]}" alt="">`;
      h.classList.add('up');
      timers.push(setTimeout(() => h.classList.remove('up'), 1150 / d));
    }
    timers.push(setTimeout(spawn, Math.max(330, 820 / d - (30 - time) * 8)));
  }
  holes.forEach(h => h.addEventListener('pointerdown', () => {
    if (ended || !h.classList.contains('up')) return;
    h.classList.remove('up');
    if (h.dataset.kind === 'bomb') {
      score = Math.max(0, score - 3);
      const g = $('#mg', root); g.classList.add('shake'); timers.push(setTimeout(() => g.classList.remove('shake'), 350));
    } else {
      score++;
      h.classList.add('hit'); timers.push(setTimeout(() => h.classList.remove('hit'), 220));
    }
    hud();
  }));
  const clock = setInterval(() => { time--; hud(); if (time <= 0) end(); }, 1000);
  function end() {
    if (ended) return;
    ended = true; clearInterval(clock); timers.forEach(clearTimeout);
    finishGame('mole', score, score * 2);
  }
  hud(); spawn();
  return { stop() { ended = true; clearInterval(clock); timers.forEach(clearTimeout); } };
}

// Copy Paws: watch the paws light up, then tap them in the same order. One more each round.
function runCopy(root) {
  const d = difficulty('copy');
  root.innerHTML = gameHead() + `<div class="copy-msg" id="cmsg">Watch!</div>
    <div class="copy-grid">${['pink', 'blue', 'green', 'gold'].map((c, i) =>
      `<button class="pad ${c}" data-i="${i}" type="button" aria-label="${c} paw">🐾</button>`).join('')}</div>
    <p class="hint">Watch the paws light up, then tap them in the same order.</p>`;
  const pads = [...root.querySelectorAll('.pad')];
  let seq = [], input = 0, score = 0, busy = true, ended = false;
  const timers = [];
  const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
  const msg = t => { $('#cmsg', root).textContent = t; };
  const hud = () => {
    $('#gTime', root).textContent = `Round ${score + 1}`;
    $('#gScore', root).textContent = score;
    $('#gExtra', root).textContent = '';
  };
  async function nextRound() {
    busy = true; hud(); msg('Watch!');
    seq.push(Math.floor(Math.random() * 4));
    if (seq.length === 1) seq.push(Math.floor(Math.random() * 4));
    await wait(650);
    for (const i of seq) {
      if (ended) return;
      pads[i].classList.add('lit'); await wait(480 / d);
      pads[i].classList.remove('lit'); await wait(200 / d);
    }
    if (ended) return;
    input = 0; busy = false; msg('Your turn!');
  }
  pads.forEach((pad, i) => pad.addEventListener('click', () => {
    if (busy || ended) return;
    pad.classList.add('lit'); timers.push(setTimeout(() => pad.classList.remove('lit'), 180));
    if (i !== seq[input]) {
      ended = true; msg('Oops!');
      timers.push(setTimeout(() => finishGame('copy', score, score * 6), 700));
      return;
    }
    input++;
    if (input === seq.length) { score++; msg('Great!'); timers.push(setTimeout(nextRound, 400)); }
  }));
  nextRound();
  return { stop() { ended = true; timers.forEach(clearTimeout); } };
}

// Hop Run: your own pet runs along. Jump over rocks, grab the coins.
function runHop(root) {
  const d = difficulty('hop');
  root.innerHTML = gameHead() + `<canvas id="gc" width="360" height="300"></canvas>
    <p class="hint">Tap the screen or press Space to jump! Grab 🪙, hop over the rocks.</p>`;
  const cv = $('#gc', root), ctx = cv.getContext('2d'), W = 360, H = 300, G = 250, PX = 72;
  const pet = activePet();
  const img = new Image();
  if (pet && SPECIES[pet.species].img) img.src = SPECIES[pet.species].img;
  let y = G, vy = 0, score = 0, lives = 3, time = 30, obs = [], coins = [], spawnO = 1.2, spawnC = 0.5, inv = 0, raf = 0;
  let speed = 170 * d, last = performance.now();
  const jump = () => { if (y >= G - 0.5) vy = -440; };
  const kd = e => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } };
  cv.addEventListener('pointerdown', jump);
  addEventListener('keydown', kd);
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    time -= dt; speed += dt * 4 * d; inv = Math.max(0, inv - dt);
    vy += 1150 * dt; y = Math.min(G, y + vy * dt); if (y >= G) vy = 0;
    spawnO -= dt;
    if (spawnO <= 0) { spawnO = (1.15 + Math.random() * 0.9) / d; obs.push({ x: W + 20, e: Math.random() < 0.5 ? '🪨' : '🍄' }); }
    spawnC -= dt;
    if (spawnC <= 0) { spawnC = 0.6 + Math.random() * 0.8; coins.push({ x: W + 20, y: G - 50 - Math.random() * 100 }); }
    for (const o of obs) o.x -= speed * dt;
    for (const c of coins) c.x -= speed * dt;
    for (const o of obs) if (!o.hit && inv <= 0 && Math.abs(o.x - PX) < 26 && y > G - 34) { o.hit = true; lives--; inv = 1; }
    for (const c of coins) if (!c.got && Math.abs(c.x - PX) < 30 && Math.abs(c.y - (y - 36)) < 40) { c.got = true; score++; }
    obs = obs.filter(o => o.x > -30);
    coins = coins.filter(c => c.x > -30 && !c.got);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#cfeaff'); g.addColorStop(1, '#fff6e0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fd46a'; ctx.fillRect(0, G, W, H - G);
    ctx.fillStyle = '#6fb34a'; ctx.fillRect(0, G, W, 6);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '24px serif';
    for (const c of coins) ctx.fillText('🪙', c.x, c.y);
    ctx.font = '32px serif';
    for (const o of obs) ctx.fillText(o.e, o.x, G - 14);
    if (!(inv > 0 && Math.floor(inv * 10) % 2)) {
      if (img.complete && img.naturalWidth) {
        const s = 76, r = img.naturalWidth / img.naturalHeight;
        const w = r >= 1 ? s : s * r, h = r >= 1 ? s / r : s;
        ctx.drawImage(img, PX - w / 2, y - h, w, h);
      } else { ctx.font = '44px serif'; ctx.fillText('🐾', PX, y - 24); }
    }
    $('#gTime', root).textContent = Math.max(0, Math.ceil(time));
    $('#gScore', root).textContent = score;
    $('#gExtra', root).textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(3 - Math.max(0, lives));
    if (time <= 0 || lives <= 0) { finishGame('hop', score, score * 3 + (lives > 0 ? 10 : 0)); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); removeEventListener('keydown', kd); } };
}

// Snack Time: your pet asks for a snack; tap the right one before the timer runs out.
function runSnack(root) {
  const d = difficulty('snack');
  const pet = activePet();
  const petImg = pet && SPECIES[pet.species].img;
  root.innerHTML = gameHead() + `<div class="snack-stage">
      <div class="snack-pet">${petImg ? `<img src="${petImg}" alt="">` : '🐾'}<div class="snack-want" id="want"></div></div>
      <div class="snack-timer"><div id="stb"></div></div>
      <div class="snack-row" id="srow"></div>
    </div>
    <p class="hint">Your pet wants a snack! Tap the one in the bubble, quick!</p>`;
  const icons = [...new Set([...FOODS, ...DRINKS].map(f => f.icon))];
  let score = 0, time = 30, ended = false, want = '', orderT = 0, orderMax = 0, raf = 0, last = performance.now();
  const opts = () => Math.min(8, 4 + Math.floor((d - 1) * 10) + Math.floor(score / 6));
  const hud = () => { $('#gTime', root).textContent = Math.max(0, Math.ceil(time)); $('#gScore', root).textContent = score; $('#gExtra', root).textContent = ''; };
  function order() {
    const n = opts();
    const pick = icons.slice().sort(() => Math.random() - 0.5).slice(0, n);
    want = pick[Math.floor(Math.random() * n)];
    $('#want', root).textContent = want;
    $('#srow', root).innerHTML = pick.map(i => `<button class="snack" type="button" data-i="${i}">${i}</button>`).join('');
    root.querySelectorAll('.snack').forEach(b => b.onpointerdown = () => tap(b));
    orderMax = orderT = Math.max(1.3, 3.2 / d - score * 0.04);
  }
  function tap(b) {
    if (ended) return;
    if (b.dataset.i === want) {
      score++; b.classList.add('yum');
      const pi = $('.snack-pet', root); pi.classList.remove('munch'); void pi.offsetWidth; pi.classList.add('munch');
      setTimeout(order, 180);
    } else {
      score = Math.max(0, score - 1); b.classList.add('nope'); setTimeout(() => b.classList.remove('nope'), 300);
    }
    hud();
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    time -= dt; orderT -= dt;
    $('#stb', root).style.width = Math.max(0, orderT / orderMax * 100) + '%';
    if (orderT <= 0) order();          // too slow: the pet asks for something else
    hud();
    if (time <= 0) { ended = true; finishGame('snack', score, score * 2); return; }
    raf = requestAnimationFrame(frame);
  }
  order(); hud();
  raf = requestAnimationFrame(frame);
  return { stop() { ended = true; cancelAnimationFrame(raf); } };
}

// Jobs: customers (other pets) come to the counter with an order ticket.
// Tap the ingredients in the same order as the ticket. Fast orders get a tip.
const JOBS = {
  burger: {
    title: 'Burger Diner', chef: '🧑‍🍳', start: ['🍞'], end: ['🍞'], endName: 'Top bun',
    parts: { '🍞': 'Bun', '🥩': 'Patty', '🧀': 'Cheese', '🥬': 'Lettuce', '🍅': 'Tomato', '🥓': 'Bacon', '🧅': 'Onion', '🥒': 'Pickle' },
    middle: ['🥩', '🧀', '🥬', '🍅', '🥓', '🧅', '🥒'], stackUp: true,
  },
  icecream: {
    title: 'Ice Cream Shop', chef: '🍨', start: null, startPick: ['🍦', '🥣'], end: null,
    parts: { '🍦': 'Cone', '🥣': 'Cup', '🍫': 'Chocolate', '🍓': 'Strawberry', '🍋': 'Lemon', '🫐': 'Blueberry', '🍪': 'Cookie', '🥭': 'Mango', '🍒': 'Cherry', '✨': 'Sprinkles', '🍯': 'Honey' },
    middle: ['🍫', '🍓', '🍋', '🫐', '🍪', '🥭'], topPick: ['🍒', '✨', '🍯'], stackUp: true,
  },
  pizza: {
    title: 'Pizza Place', chef: '👨‍🍳', start: ['🫓', '🥫', '🧀'], end: ['🔥'],
    parts: { '🫓': 'Dough', '🥫': 'Sauce', '🧀': 'Cheese', '🍄': 'Mushroom', '🫑': 'Pepper', '🍍': 'Pineapple', '🥓': 'Bacon', '🫒': 'Olive', '🌽': 'Corn', '🔥': 'Bake!' },
    middle: ['🍄', '🫑', '🍍', '🥓', '🫒', '🌽'], noRepeat: true,
  },
  cafe: {
    title: 'Cozy Café', chef: '🧑‍🍳', start: null, startPick: ['☕', '🍵', '🧋'], end: null,
    parts: { '☕': 'Coffee', '🍵': 'Tea', '🧋': 'Boba', '🥛': 'Milk', '🍫': 'Chocolate', '🍯': 'Honey', '🧊': 'Ice', '🍓': 'Strawberry', '🍦': 'Cream', '🍪': 'Cookie' },
    middle: ['🥛', '🍫', '🍯', '🧊', '🍓', '🍦'], topPick: ['🍪'], noRepeat: true,
  },
  flowers: {
    title: 'Flower Shop', chef: '🌷', start: null, startPick: ['🏺', '🧺'], end: ['🎀'], ticket: 'BOUQUET',
    ask: ['"Flowers for my mom, please!"', '"It\'s my friend\'s birthday!"', '"Something pretty, please!"'],
    parts: { '🏺': 'Vase', '🧺': 'Basket', '🌹': 'Rose', '🌷': 'Tulip', '🌻': 'Sunflower', '🌼': 'Daisy', '🪻': 'Lavender', '🌸': 'Blossom', '🌿': 'Leaves', '🎀': 'Ribbon' },
    middle: ['🌹', '🌷', '🌻', '🌼', '🪻', '🌸', '🌿'],
  },
  toys: {
    title: 'Toy Shop', chef: '🧸', start: ['📦'], end: ['🎀'], ticket: 'GIFT ORDER', stackUp: true,
    ask: ['"Can you wrap a present?"', '"A gift for my little brother!"', '"I want the best toys!"'],
    parts: { '📦': 'Box', '🧸': 'Teddy', '🪀': 'Yo-yo', '🪁': 'Kite', '🚂': 'Train', '🎨': 'Paints', '⚽': 'Ball', '🧩': 'Puzzle', '🎀': 'Ribbon' },
    middle: ['🧸', '🪀', '🪁', '🚂', '🎨', '⚽', '🧩'], noRepeat: true,
  },
  vet: {
    title: 'Pet Vet', chef: '🩺', start: ['🩺'], end: ['🍬'], ticket: 'PATIENT CHART',
    ask: ['"My tummy feels funny…"', '"I bumped my paw!"', '"Achoo! I have a cold."', '"Time for my check-up!"'],
    parts: { '🩺': 'Listen', '🌡️': 'Temperature', '💊': 'Medicine', '🩹': 'Bandage', '💉': 'Shot', '🧴': 'Cream', '🛁': 'Bath', '🪥': 'Brush teeth', '🍬': 'Treat!' },
    middle: ['🌡️', '💊', '🩹', '💉', '🧴', '🛁', '🪥'], noRepeat: true,
  },
  bakery: {
    title: 'Cake Bakery', chef: '🧁', start: ['🍽️'], end: ['🕯️'], ticket: 'CAKE ORDER', stackUp: true,
    ask: ['"A birthday cake, please!"', '"The biggest cake you can make!"', '"A cake for a party!"'],
    parts: { '🍽️': 'Plate', '🍰': 'Vanilla', '🍫': 'Chocolate', '🍓': 'Strawberry', '🍋': 'Lemon', '🥥': 'Coconut', '🍯': 'Honey', '🍒': 'Cherry', '🕯️': 'Candle' },
    middle: ['🍰', '🍫', '🍓', '🍋', '🥥', '🍯', '🍒'],
  },
};

function runJob(root, key) {
  const job = JOBS[key], d = difficulty(key);
  const pet = activePet();
  const petImg = pet && SPECIES[pet.species].img;
  // Customers are pets you've found (or any common pet if you haven't found many yet).
  let crowd = state.dex.filter(id => SPECIES[id]);
  if (crowd.length < 4) crowd = Object.keys(SPECIES).filter(id => SPECIES[id].rarity === 'common');
  root.innerHTML = gameHead() + `<div class="job-stage">
      <div class="job-top">
        <div class="job-cust" id="cust"></div>
        <div class="job-ticket" id="ticket"></div>
      </div>
      <div class="job-patience"><div id="jpb"></div></div>
      <div class="job-counter">
        <div class="job-plate ${job.stackUp ? 'up' : ''}" id="plate"></div>
        <div class="job-worker">${petImg ? `<img src="${petImg}" alt="">` : '🐾'}<span>${job.chef}</span></div>
      </div>
      <div class="job-msg" id="jmsg">Here comes a customer!</div>
      <div class="job-bins" id="bins"></div>
    </div>
    <p class="hint">Tap the ingredients in the same order as the ticket. Fast = bigger tip! 💰</p>`;
  const all = [...new Set([...(job.start || []), ...(job.startPick || []), ...job.middle, ...(job.topPick || []), ...(job.end || [])])];
  $('#bins', root).innerHTML = all.map(i => `<button class="job-bin" type="button" data-i="${i}"><span>${i}</span><small>${job.parts[i]}</small></button>`).join('');
  root.querySelectorAll('.job-bin').forEach(b => b.onpointerdown = e => { e.preventDefault(); tap(b); });

  let score = 0, coins = 0, time = 60, ended = false, order = [], step = 0, pat = 0, patMax = 0, served = 0, raf = 0, last = performance.now(), busy = false;
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const hud = () => { $('#gTime', root).textContent = Math.max(0, Math.ceil(time)); $('#gScore', root).textContent = score; $('#gExtra', root).textContent = `🪙 ${Math.round(coins * coinBonus(key))}`; };
  const say = (t, cls = '') => { const m = $('#jmsg', root); m.textContent = t; m.className = 'job-msg ' + cls; };

  function newOrder() {
    // Orders get longer as you serve more, and on higher job levels.
    const n = Math.min(job.middle.length, 1 + Math.floor((d - 1) * 6) + Math.floor(served / 2) + (Math.random() < 0.5 ? 1 : 0));
    let mid = [];
    for (let i = 0; i < n; i++) {
      let x = rnd(job.middle);
      if (job.noRepeat) { const left = job.middle.filter(m => !mid.includes(m)); x = rnd(left); }
      mid.push(x);
    }
    order = [...(job.start || [rnd(job.startPick)]), ...mid, ...(job.topPick && Math.random() < 0.7 ? [rnd(job.topPick)] : []), ...(job.end || [])];
    step = 0;
    patMax = pat = Math.max(4, (3 + order.length * 1.6) / d - served * 0.08);
    const who = SPECIES[rnd(crowd)];
    $('#cust', root).innerHTML = `<img src="${who.img}" alt=""><b>${who.name}</b>`;
    $('#cust', root).classList.remove('leave'); void $('#cust', root).offsetWidth; $('#cust', root).classList.add('arrive');
    drawTicket(); drawPlate(); busy = false;
    say(job.ask ? rnd(job.ask) : `"One ${job.title === 'Cozy Café' ? 'drink' : 'order'}, please!"`);
  }
  function drawTicket() {
    $('#ticket', root).innerHTML = `<div class="tk-head">${job.ticket || 'ORDER'} #${served + 1}</div>` + order.map((i, n) =>
      `<div class="tk-row ${n < step ? 'done' : n === step ? 'now' : ''}"><span>${i}</span>${job.parts[i]}</div>`).join('');
  }
  function drawPlate() {
    const made = order.slice(0, step);
    $('#plate', root).innerHTML = (job.stackUp ? [...made].reverse() : made).map(i => `<span>${i}</span>`).join('');
  }
  function tap(b) {
    if (ended || busy) return;
    if (b.dataset.i === order[step]) {
      step++; b.classList.remove('yum'); void b.offsetWidth; b.classList.add('yum');
      drawTicket(); drawPlate();
      if (step === order.length) serve();
    } else {
      b.classList.add('nope'); setTimeout(() => b.classList.remove('nope'), 300);
      pat -= 1.2;   // mistakes make the customer wait longer
      say(`Oops! The ticket says ${job.parts[order[step]]} ${order[step]}`, 'bad');
    }
  }
  function serve() {
    busy = true;
    const tip = pat / patMax > 0.6 ? 3 : pat / patMax > 0.3 ? 1 : 0;
    const pay = Math.round((Math.ceil(order.length / 2) + tip) * jobTier(key));
    coins += pay; score++; served++;
    const shown = Math.round(pay * coinBonus(key));   // what you'll really get, with the level bonus
    say(tip >= 3 ? `⭐ Super fast! +🪙 ${shown} (tip!)` : tip ? `😊 Thanks! +🪙 ${shown} (tip!)` : `🙂 Thanks! +🪙 ${shown}`, 'good');
    $('#cust', root).classList.add('leave');
    hud();
    setTimeout(() => { if (!ended) newOrder(); }, 700);
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    time -= dt;
    if (!busy) {
      pat -= dt;
      if (pat <= 0) {   // waited too long: the customer leaves
        busy = true;
        say('😤 Too slow! The customer left.', 'bad');
        $('#cust', root).classList.add('leave');
        setTimeout(() => { if (!ended) newOrder(); }, 800);
      }
    }
    const bar = $('#jpb', root);
    bar.style.width = Math.max(0, pat / patMax * 100) + '%';
    bar.className = pat / patMax < 0.3 ? 'low' : '';
    hud();
    if (time <= 0) { ended = true; finishGame(key, score, coins); return; }
    raf = requestAnimationFrame(frame);
  }
  newOrder(); hud();
  raf = requestAnimationFrame(frame);
  return { stop() { ended = true; cancelAnimationFrame(raf); } };
}

// Hide & Seek: your pet hides under a cup, the cups shuffle, find the right one.
function runSeek(root) {
  const d = difficulty('seek');
  const pet = activePet();
  const petImg = pet && SPECIES[pet.species].img;
  root.innerHTML = gameHead() + `<div class="seek-msg" id="smsg">Watch where I hide!</div>
    <div class="seek-stage" id="stage"></div>
    <p class="hint">Keep your eyes on the cup with your pet, then tap it!</p>`;
  const stage = $('#stage', root);
  let score = 0, lives = 3, round = 0, ended = false, busy = true, cups = [], petAt = 0;
  const timers = [];
  const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
  const hud = () => {
    $('#gTime', root).textContent = `Round ${round}`;
    $('#gScore', root).textContent = score;
    $('#gExtra', root).textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
  };
  function layout(n) {
    stage.innerHTML = Array.from({ length: n }, (_, i) => `<div class="seek-slot" data-i="${i}"><div class="seek-pet">${petImg ? `<img src="${petImg}" alt="">` : '🐾'}</div><button class="seek-cup" type="button" aria-label="Cup ${i + 1}"></button></div>`).join('');
    cups = [...stage.querySelectorAll('.seek-slot')];
    cups.forEach((c, i) => { c.style.left = `${(i + 0.5) / n * 100}%`; c.pos = i; c.querySelector('.seek-cup').onclick = () => pick(c); });
  }
  async function play() {
    while (!ended && lives > 0) {
      round++; hud();
      const n = round < 4 ? 3 : round < 8 ? 4 : 5;
      layout(n);
      petAt = Math.floor(Math.random() * n);
      cups.forEach((c, i) => c.classList.toggle('has-pet', i === petAt));
      $('#smsg', root).textContent = 'Watch where I hide!';
      cups[petAt].classList.add('lift'); await wait(1100); cups[petAt].classList.remove('lift'); await wait(450);
      if (ended) return;
      $('#smsg', root).textContent = 'Shuffling...';
      const swaps = 3 + round + Math.floor((d - 1) * 10);
      const speed = Math.max(170, 520 / d - round * 22);
      stage.style.setProperty('--swap', speed + 'ms');
      for (let k = 0; k < swaps && !ended; k++) {
        const a = Math.floor(Math.random() * n); let b = Math.floor(Math.random() * (n - 1)); if (b >= a) b++;
        const ca = cups.find(c => c.pos === a), cb = cups.find(c => c.pos === b);
        ca.pos = b; cb.pos = a;
        ca.style.left = `${(b + 0.5) / n * 100}%`; cb.style.left = `${(a + 0.5) / n * 100}%`;
        ca.classList.add('hop'); cb.classList.add('dip');
        await wait(speed + 40);
        ca.classList.remove('hop'); cb.classList.remove('dip');
      }
      if (ended) return;
      $('#smsg', root).textContent = 'Where am I? Tap a cup!';
      busy = false;
      const ok = await new Promise(r => { play.answer = r; });
      busy = true;
      if (ended) return;
      cups.forEach(c => c.classList.add('lift'));
      if (ok) { score++; $('#smsg', root).textContent = '🎉 You found me!'; }
      else { lives--; $('#smsg', root).textContent = '😅 Not that one!'; }
      hud();
      await wait(1100);
      if (round >= 15) break;
    }
    if (!ended) { ended = true; finishGame('seek', score, score * 5); }
  }
  function pick(c) {
    if (busy || ended || !play.answer) return;
    const r = play.answer; play.answer = null;
    r(c.classList.contains('has-pet'));
  }
  hud(); play();
  return { stop() { ended = true; timers.forEach(clearTimeout); if (play.answer) { play.answer(false); play.answer = null; } } };
}

// Sky Glide: tap to flap your pet through the gaps in the clouds and grab stars.
function runGlide(root) {
  const d = difficulty('glide');
  root.innerHTML = gameHead() + `<canvas id="gc" width="360" height="420"></canvas>
    <p class="hint">Tap the screen or press Space to flap! Fly through the gaps, grab ⭐.</p>`;
  const cv = $('#gc', root), ctx = cv.getContext('2d'), W = 360, H = 420, PX = 90;
  const pet = activePet();
  const img = new Image();
  if (pet && SPECIES[pet.species].img) img.src = SPECIES[pet.species].img;
  let y = H / 2, vy = 0, score = 0, lives = 3, time = 40, cols = [], stars = [], spawn = 0.6, inv = 1.2, raf = 0, last = performance.now();
  const faceLeft = pet && ((window.PET_EYES || {})[pet.species] || {}).f < 0;
  const speed = 130 * d;
  const gap = Math.max(120, 170 - (d - 1) * 120);
  const flap = () => { vy = -290; };
  const kd = e => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
  cv.addEventListener('pointerdown', flap);
  addEventListener('keydown', kd);
  const cloud = (x, y, w, h) => {   // a fluffy cloud column
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(207,224,255,.5)';
    for (let k = 0; k < h; k += 34) { ctx.beginPath(); ctx.arc(x + w / 2, y + k + 17, 9, 0, Math.PI * 2); ctx.fill(); }
  };
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    time -= dt; inv = Math.max(0, inv - dt);
    vy += 760 * dt; y += vy * dt;
    if (y < 20) { y = 20; vy = 0; }
    if (y > H - 20) { y = H - 20; vy = -200; if (inv <= 0) { lives--; inv = 1.2; } }
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 1.9 / d;
      const gy = 70 + Math.random() * (H - 140 - gap);
      cols.push({ x: W + 30, gy, passed: false });
      stars.push({ x: W + 30 + 26, y: gy + gap / 2 });
    }
    for (const c of cols) c.x -= speed * dt;
    for (const s of stars) s.x -= speed * dt;
    const pr = 22;
    for (const c of cols) {
      if (!c.passed && c.x + 52 < PX) { c.passed = true; score++; }
      const hitX = PX + pr > c.x && PX - pr < c.x + 52;
      if (hitX && inv <= 0 && (y - pr < c.gy || y + pr > c.gy + gap)) { lives--; inv = 1.2; }
    }
    for (const s of stars) if (!s.got && Math.hypot(s.x - PX, s.y - y) < 32) { s.got = true; score += 2; }
    cols = cols.filter(c => c.x > -70);
    stars = stars.filter(s => s.x > -30 && !s.got);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#9fd2ff'); g.addColorStop(1, '#ffe6f2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const c of cols) { cloud(c.x, -20, 52, c.gy + 20); cloud(c.x, c.gy + gap, 52, H - c.gy - gap + 20); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '26px serif';
    for (const s of stars) ctx.fillText('⭐', s.x, s.y + Math.sin(t / 200 + s.x) * 3);
    if (!(inv > 0 && Math.floor(inv * 10) % 2)) {
      ctx.save(); ctx.translate(PX, y); ctx.rotate(Math.max(-0.4, Math.min(0.5, vy / 600)));
      if (faceLeft) ctx.scale(-1, 1);   // turn the pet around so it faces where it's flying
      if (img.complete && img.naturalWidth) {
        const s = 62, r = img.naturalWidth / img.naturalHeight;
        const w = r >= 1 ? s : s * r, h = r >= 1 ? s / r : s;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else { ctx.font = '40px serif'; ctx.fillText('🐾', 0, 0); }
      ctx.restore();
    }
    $('#gTime', root).textContent = Math.max(0, Math.ceil(time));
    $('#gScore', root).textContent = score;
    $('#gExtra', root).textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(3 - Math.max(0, lives));
    if (time <= 0 || lives <= 0) { finishGame('glide', score, score * 3 + (lives > 0 ? 10 : 0)); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); removeEventListener('keydown', kd); } };
}

/* ======================== MAIN LOOP ======================== */

function tick() {
  const now = Date.now();
  const dt = Math.min(60, (now - state.lastTick) / 1000);
  state.lastTick = now;
  simulate(dt);
  checkEvolution();
  updateHUD();
  updateBadges();
  if (currentTab === 'room') updateRoom();
  if (currentTab === 'eggs') updateIncubator();
}

// Catch up on time passed while the game was closed (at half speed, up to 2 hours).
(function catchUp() {
  const away = Math.min(7200, (Date.now() - state.lastTick) / 1000);
  if (away > 5) simulate(away, 0.5, true);
  state.lastTick = Date.now();
})();

document.querySelectorAll('#nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
$('#coins').onclick = () => go('games');   // tap coins to go earn more
$('#profileBtn').onclick = () => go('profile');
setInterval(tick, 1000);
setInterval(save, 5000);
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);
render();
