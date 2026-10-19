'use strict';
/* ==========================================================================
   SPARKPITCH — a self-contained 2D arcade soccer game
   All art is drawn procedurally. All sound is synthesized with WebAudio.
   ========================================================================== */

/* ---------------------------------- utils --------------------------------- */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const norm = (x, y) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };
const fmtCoins = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : String(Math.round(n)));
const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60), ss = s % 60;
  return m + ":" + String(ss).padStart(2, "0");
};
function weightedPick(entries) {
  const total = entries.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e.v; }
  return entries[entries.length - 1].v;
}
function toast(msg, tone) {
  const t = document.createElement("div");
  t.className = "toast" + (tone ? " " + tone : "");
  t.textContent = msg;
  $("toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(8px)"; t.style.transition = "all .25s"; }, 2200);
  setTimeout(() => t.remove(), 2600);
}
function downloadText(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ==========================================================================
   DATA — abilities, roster, cosmetics, packs
   ========================================================================== */
const RARITIES = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
const RARITY_COLOR = { Common:"#9fb6d0", Rare:"#45a3ff", Epic:"#b46bff", Legendary:"#ffb43c", Mythic:"#ff4d6d" };

const ABILITIES = [
  { id:"power",      name:"Power Shot",      cat:"Shooting",     rarity:"Common",    icon:"💥", cd:8,  color:"#ff8f3d", desc:"Your next kick launches the ball at greatly increased speed." },
  { id:"curve",      name:"Curve Shot",      cat:"Shooting",     rarity:"Common",    icon:"🌀", cd:9,  color:"#57d6ff", desc:"Your next kick bends sideways, curling around defenders." },
  { id:"flame",      name:"Flame Shot",      cat:"Shooting",     rarity:"Rare",      icon:"🔥", cd:11, color:"#ff6a2b", desc:"A fast shot that leaves a blazing trail across the turf." },
  { id:"double",     name:"Double Kick",     cat:"Shooting",     rarity:"Rare",      icon:"⏫", cd:12, color:"#ffd23f", desc:"Two rapid kicks: the second fires a fraction after the first." },
  { id:"lightning",  name:"Lightning Kick",  cat:"Shooting",     rarity:"Epic",      icon:"⚡", cd:16, color:"#aef2ff", desc:"Instantly blasts the ball at extreme speed. Long cooldown." },
  { id:"thunder",    name:"Thunder Shot",    cat:"Shooting",     rarity:"Epic",      icon:"🌩️", cd:18, color:"#c9f0ff", desc:"The ball crackles for a few seconds: your next kick is faster and shocks whoever it hits." },
  { id:"boomerang",  name:"Boomerang Ball",  cat:"Shooting",     rarity:"Epic",      icon:"🪃", cd:20, color:"#7bffcf", desc:"Your next shot curves back to a marked spot near you if it does not score." },
  { id:"ricochet",   name:"Ricochet Shot",   cat:"Shooting",     rarity:"Epic",      icon:"↩️", cd:19, color:"#ffd479", desc:"Your next kick keeps almost all its speed when it bounces off a side wall." },
  { id:"cloneshot",  name:"Clone Shot",      cat:"Shooting",     rarity:"Legendary", icon:"🎱", cd:24, color:"#c7a6ff", desc:"Your next kick sends out two decoy balls. Only the real one can score." },
  { id:"portal",     name:"Portal Shot",     cat:"Shooting",     rarity:"Mythic",    icon:"🌀", cd:28, color:"#ff4d6d", desc:"Your next kick vanishes and reappears 150px along its path. It can never land inside a goal." },
  { id:"phoenix",    name:"Phoenix Shot",    cat:"Shooting",     rarity:"Mythic",    icon:"🦅", cd:30, color:"#ff8f3d", desc:"Flames on your next shot: if an opponent blocks it, it rebounds with one last burst instead of stopping." },
  { id:"teleport",   name:"Teleport",        cat:"Movement",     rarity:"Rare",      icon:"🛸", cd:13, color:"#b46bff", desc:"Blink a short distance toward the ball if the landing spot is safe." },
  { id:"dash",       name:"Super Dash",      cat:"Movement",     rarity:"Common",    icon:"💨", cd:7,  color:"#8fe8ff", desc:"Propels you forward in a burst of speed." },
  { id:"blink",      name:"Blink Dodge",     cat:"Movement",     rarity:"Common",    icon:"✨", cd:8,  color:"#ff9ee0", desc:"Teleports you a short distance in the direction you are moving." },
  { id:"magnetboots",name:"Magnetic Boots",  cat:"Movement",     rarity:"Common",    icon:"🧲", cd:10, color:"#ff5d8f", desc:"Briefly pulls the ball toward you whenever it is nearby." },
  { id:"sprint",     name:"Super Sprint",    cat:"Movement",     rarity:"Common",    icon:"🏃", cd:9,  color:"#48e08a", desc:"Gives you a burst of extra running speed for a few seconds." },
  { id:"shield",     name:"Shield",          cat:"Defensive",    rarity:"Rare",      icon:"🛡️", cd:14, color:"#4fb3ff", desc:"Blocks incoming enemy ability effects for a short time." },
  { id:"goalwall",   name:"Goal Wall",       cat:"Defensive",    rarity:"Rare",      icon:"🧱", cd:22, color:"#ffb46b", desc:"Raises a temporary barrier in front of your own goal." },
  { id:"freeze",     name:"Ball Freeze",     cat:"Defensive",    rarity:"Epic",      icon:"🧊", cd:18, color:"#9fe6ff", desc:"Stops the ball dead for a moment, killing its momentum." },
  { id:"superblock", name:"Super Block",     cat:"Defensive",    rarity:"Common",    icon:"🚧", cd:11, color:"#ffd166", desc:"Your body becomes a much bigger wall for a short time." },
  { id:"keeper",     name:"Goalkeeper Mode", cat:"Defensive",    rarity:"Rare",      icon:"🧤", cd:15, color:"#7bffcf", desc:"Auto-deflect incoming shots near your goal for a short time." },
  { id:"fake",       name:"Fake Shot",       cat:"Ball control", rarity:"Common",    icon:"🎭", cd:8,  color:"#d3a0ff", desc:"Winds up a fake kick, then strikes the ball a beat later." },
  { id:"gravity",    name:"Gravity Pull",    cat:"Ball control", rarity:"Rare",      icon:"🕳️", cd:12, color:"#a06bff", desc:"Pulls the ball toward you while you stay in range." },
  { id:"recall",     name:"Ball Recall",     cat:"Ball control", rarity:"Epic",      icon:"↩️", cd:16, color:"#5affd6", desc:"Rewinds the ball toward where it was a moment ago." },
  { id:"sticky",     name:"Sticky Ball",     cat:"Ball control", rarity:"Rare",      icon:"🫧", cd:12, color:"#ff8ad8", desc:"Glues the ball to your feet briefly, then releases it." },
  { id:"chaos",      name:"Chaos Ball",      cat:"Ball control", rarity:"Epic",      icon:"🎲", cd:15, color:"#ff5f5f", desc:"Makes the ball jink unpredictably for a few seconds." },
  { id:"gravityball",name:"Gravity Ball",    cat:"Ball control", rarity:"Legendary", icon:"🕳️", cd:23, color:"#a06bff", desc:"Your next kick leaves a well that drags nearby opponents toward the ball." },
  { id:"magneticsteal",name:"Magnetic Steal",cat:"Ball control", rarity:"Legendary", icon:"🧲", cd:25, color:"#ff5d8f", desc:"Yanks a nearby loose ball, or the ball off a close opponent, into your feet." },
  { id:"phantom",    name:"Phantom Ball",    cat:"Ball control", rarity:"Legendary", icon:"👻", cd:25, color:"#c9b6ff", desc:"Your next kick turns the ball translucent and it passes straight through players. Walls still hold it." },
  { id:"tornado",    name:"Tornado Ball",    cat:"Ball control", rarity:"Epic",      icon:"🌪️", cd:20, color:"#9fd0ff", desc:"Your next kick wraps the ball in a whirlwind that shoves opponents away as it travels." },
  { id:"shieldball", name:"Shield Ball",     cat:"Ball control", rarity:"Rare",      icon:"🔵", cd:15, color:"#4fb3ff", desc:"A shield on the ball blunts the next opponent touch, so it keeps rolling your way." },
  { id:"shockwave",  name:"Shockwave",       cat:"Tactical",     rarity:"Common",    icon:"🌊", cd:10, color:"#63e0ff", desc:"Pushes nearby opponents away without removing them." },
  { id:"swap",       name:"Swap",            cat:"Tactical",     rarity:"Rare",      icon:"🔁", cd:14, color:"#ffd166", desc:"Switch places with your teammate in 2v2." },
  { id:"clone",      name:"Clone",           cat:"Tactical",     rarity:"Epic",      icon:"👥", cd:18, color:"#c7a6ff", desc:"Spawns a decoy that distracts opponents. It cannot score." },
  { id:"teamboost",  name:"Team Boost",      cat:"Tactical",     rarity:"Rare",      icon:"📣", cd:16, color:"#7bffb0", desc:"Gives your teammates a short burst of speed." },
  { id:"reverse",    name:"Reverse Controls",cat:"Tactical",     rarity:"Epic",      icon:"🔀", cd:14, color:"#ff7bd5", desc:"Briefly flips the movement direction of nearby opponents." },
  { id:"sonic",      name:"Sonic Boom",      cat:"Tactical",     rarity:"Epic",      icon:"🔊", cd:20, color:"#63e0ff", desc:"Your next kick releases a sound wave that shoves nearby opponents back." },
  { id:"quake",      name:"Earthquake Shot", cat:"Tactical",     rarity:"Epic",      icon:"🌋", cd:20, color:"#ffb46b", desc:"Your next shot erupts on impact, shoving everyone near it off the ball." },
  { id:"rocket",     name:"Rocket Ball",     cat:"Special",      rarity:"Legendary", icon:"🚀", cd:20, color:"#ff9d1f", desc:"Your next kick becomes a near-unstoppable rocket with a trail." },
  { id:"minigoal",   name:"Mini Goal",       cat:"Special",      rarity:"Legendary", icon:"🎯", cd:26, color:"#ffcf3f", desc:"Places a bonus target near the enemy goal. Passing through it pays coins." },
  { id:"timeslow",   name:"Time Slow",       cat:"Special",      rarity:"Epic",      icon:"⏳", cd:16, color:"#9fd0ff", desc:"Slows nearby opponents for a few seconds." },
  { id:"ballmagnet", name:"Ball Magnet",     cat:"Special",      rarity:"Rare",      icon:"🎛️", cd:14, color:"#4be0a5", desc:"Yanks the ball toward a glowing point ahead of you." },
  { id:"pulse",      name:"Power Pulse",     cat:"Special",      rarity:"Common",    icon:"💫", cd:9,  color:"#ffe66b", desc:"A short-range burst that shoves the ball and opponents away." },
];
const ABIL_BY_ID = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

/* Signatures are always available for the selected character — one per player,
   on its own key, independent of the two pack-earned ability slots. */
const SIGNATURES = {
  pip:     { id:"sig-step",     name:"Spark Step",     icon:"✨", color:"#2ee6c5", cd:9,  mech:"sprint",  desc:"A quick burst of pace from a standing start." },
  juno:    { id:"sig-cut",      name:"Quick Cut",      icon:"💨", color:"#ff8a3d", cd:8,  mech:"blink",   desc:"Slips sideways past a defender in a blink." },
  nix:     { id:"sig-cool",     name:"Cool Head",      icon:"🛡️", color:"#a06bff", cd:14, mech:"shield",  desc:"Calm under pressure — shrugs off push abilities briefly." },
  bolt:    { id:"sig-turbo",    name:"Turbo Boots",    icon:"⚡", color:"#ffcf3f", cd:7,  mech:"dash",    desc:"A short explosive sprint in the way you are facing." },
  mango:   { id:"sig-show",     name:"Showstopper",    icon:"💥", color:"#ff5d8f", cd:9,  mech:"power",   desc:"Loads the next kick with extra power." },
  rex:     { id:"sig-roar",     name:"Roar Push",      icon:"📣", color:"#48e08a", cd:11, mech:"roar",    desc:"A short shockwave shoves nearby rivals and nudges the ball clear." },
  nova:    { id:"sig-star",     name:"Star Pull",      icon:"🌟", color:"#7ad7ff", cd:13, mech:"pull",    desc:"Gradually reels a nearby ball toward a glowing point." },
  wisp:    { id:"sig-fade",     name:"Fade Step",      icon:"👻", color:"#c9b6ff", cd:10, mech:"blink",   desc:"Drifts a short distance in the direction you are moving." },
  blaze:   { id:"sig-flame",    name:"Flame Drive",    icon:"🔥", color:"#ff6a2b", cd:11, mech:"flame",   desc:"The next kick is faster and leaves a burning trail." },
  volt:    { id:"sig-lvolt",    name:"Lightning Dash", icon:"🌩️", color:"#ffe66b", cd:8,  mech:"ldash",   desc:"Crackles forward with a fast, short electric dash." },
  frost:   { id:"sig-ice",      name:"Ice Stop",       icon:"🧊", color:"#9fe6ff", cd:12, mech:"ice",    desc:"Chills the ball in a limited area, briefly slowing it right down." },
  phantom: { id:"sig-shadow",   name:"Shadow Blink",   icon:"🌑", color:"#b46bff", cd:9,  mech:"blink",   desc:"Teleports a short distance the way you are moving, staying in bounds." },
  magneto: { id:"sig-mag",      name:"Magnetic Pull",  icon:"🧲", color:"#ff5d8f", cd:12, mech:"pull",    desc:"Drags a nearby ball smoothly toward you." },
  titan:   { id:"sig-guard",    name:"Guardian Shield",icon:"🛡️", color:"#7ad7ff", cd:15, mech:"guard",   desc:"Temporarily softens enemy pushes without making you invincible." },
  mirage:  { id:"sig-decoy",    name:"Decoy",          icon:"👥", color:"#c9b6ff", cd:16, mech:"decoy",   desc:"Spawns a copy that distracts opponents. It cannot score." },
  ace:     { id:"sig-ace",      name:"Perfect Strike", icon:"🎯", color:"#ffcf3f", cd:10, mech:"ace",     desc:"Sharper aim and a little more pace on the next kick — never a guaranteed goal." },
  shadow:  { id:"sig-gravity",  name:"Gravity Pulse",  icon:"🕳️", color:"#7b5cff", cd:14, mech:"pulsepull",desc:"Briefly attracts the ball toward a point just ahead of you." },
};
const CHARACTERS = [
  { id:"pip",   name:"Pip",   color:"#2ee6c5", face:"happy",   price:0,    rarity:"Starter",   bio:"A scrappy spark with a bottomless tank of energy. Always first to kick-off.", tags:["Balanced","Homegrown"] },
  { id:"juno",  name:"Juno",  color:"#ff8a3d", face:"cheeky",  price:250,  rarity:"Rookie",    bio:"A winger who never stops running. The beanie is practically welded on.", tags:["Winger","Relentless"] },
  { id:"nix",   name:"Nix",   color:"#a06bff", face:"chill",   price:400,  rarity:"Rare",      bio:"Night-pitch specialist. Headphones on, outside noise off.", tags:["Playmaker","Ice cold"] },
  { id:"bolt",  name:"Bolt",  color:"#ffcf3f", face:"spark",   price:650,  rarity:"Rare",      bio:"Talks fast, runs faster, and somehow always finds the loose ball.", tags:["Sprinter","Direct"] },
  { id:"mango", name:"Mango", color:"#ff5d8f", face:"cheeky",  price:850,  rarity:"Epic",      bio:"A showy finisher with an eye for the spectacular and a nose for the net.", tags:["Finisher","Flair"] },
  { id:"rex",   name:"Rex",   color:"#48e08a", face:"focused", price:1100, rarity:"Epic",      bio:"Captain energy. Believes every single match is a cup final.", tags:["Leader","Power"] },
  { id:"nova",  name:"Nova",  color:"#7ad7ff", face:"royal",   price:1600, rarity:"Legendary", bio:"Plays like gravity bends politely around her boots.", tags:["Star","Composed"] },
  { id:"wisp",  name:"Wisp",  color:"#c9b6ff", face:"mystic",  price:2200, rarity:"Legendary", bio:"A mystery wrapped in a scarf. Nobody has ever seen a full celebration.", tags:["Enigma","Floaty"] },
  { id:"blaze",   name:"Blaze",   color:"#ff6a2b", face:"focused", price:1300, rarity:"Epic",      bio:"Plays like the turf is on fire and the ball is the last exit. Never stops moving.", tags:["Power","Trailblazer"] },
  { id:"volt",    name:"Volt",    color:"#ffe66b", face:"spark",   price:900,  rarity:"Rare",      bio:"Twitchy, electric, impossible to pin down for a full second.", tags:["Sprinter","Live wire"] },
  { id:"frost",   name:"Frost",   color:"#9fe6ff", face:"chill",   price:750,  rarity:"Rare",      bio:"Reads the game two passes ahead and cools every hot streak.", tags:["Controller","Calm"] },
  { id:"phantom", name:"Phantom", color:"#b46bff", face:"mystic",  price:1400, rarity:"Epic",      bio:"Appears where you least expect, usually already past you.", tags:["Elusive","Blink"] },
  { id:"magneto", name:"Magneto", color:"#ff5d8f", face:"royal",   price:1200, rarity:"Epic",      bio:"Claims the ball is simply attracted to good ideas.", tags:["Ball control","Magnetic"] },
  { id:"titan",   name:"Titan",   color:"#7ad7ff", face:"focused", price:1700, rarity:"Legendary", bio:"A walking wall with a soft spot for clean sheets.", tags:["Defender","Immovable"] },
  { id:"mirage",  name:"Mirage",  color:"#c9b6ff", face:"mystic",  price:1500, rarity:"Legendary", bio:"You mark one of them, then realise there were two all along.", tags:["Trickster","Decoy"] },
  { id:"ace",     name:"Ace",     color:"#ffcf3f", face:"cheeky",  price:1000, rarity:"Epic",      bio:"Lives for the one clean strike that decides everything.", tags:["Finisher","Precise"] },
  { id:"shadow",  name:"Shadow",  color:"#7b5cff", face:"chill",   price:1900, rarity:"Legendary", bio:"Bends the space around the ball. Denies it, then takes it.", tags:["Gravity","Enigma"] },
];
const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

const COLORS = [
  { id:"mint",   name:"Mint",   hex:"#2ee6c5", price:0 },
  { id:"rose",   name:"Rose",   hex:"#ff5d8f", price:0 },
  { id:"sky",    name:"Sky",    hex:"#41a8ff", price:0 },
  { id:"lemon",  name:"Lemon",  hex:"#ffd23f", price:0 },
  { id:"violet", name:"Violet", hex:"#a06bff", price:0 },
  { id:"lime",   name:"Lime",   hex:"#8ef04a", price:0 },
  { id:"ember",  name:"Ember",  hex:"#ff7a3d", price:0 },
  { id:"cotton", name:"Cotton", hex:"#ffb3d9", price:0 },
  { id:"ice",    name:"Ice",    hex:"#b7f4ff", price:0 },
  { id:"sand",   name:"Sand",   hex:"#e8cf9a", price:0 },
  { id:"grape",  name:"Grape",  hex:"#7d5cff", price:0 },
  { id:"onyx",   name:"Onyx",   hex:"#3a4266", price:0 },
];
const HAT_COLORS = ["#ff3d81","#ff8a3d","#ffd23f","#8ef04a","#2ee6c5","#41a8ff","#7d5cff","#ffb3d9","#b7f4ff","#e8cf9a","#ffffff","#2b3a66"];
const BALL_COLORS = [
  { id:"classic", name:"Classic", hex:"#f4f8ff" },
  { id:"sun",     name:"Sun",     hex:"#ffe66b" },
  { id:"rose",    name:"Rose",    hex:"#ff9ec4" },
  { id:"mint",    name:"Mint",    hex:"#8effe0" },
  { id:"sky",     name:"Sky",     hex:"#9bd8ff" },
  { id:"violet",  name:"Violet",  hex:"#c9b6ff" },
  { id:"ember",   name:"Ember",   hex:"#ffb16b" },
  { id:"lime",    name:"Lime",    hex:"#c8ff7a" },
  { id:"coral",   name:"Coral",   hex:"#ff8f8f" },
  { id:"gold",    name:"Gold",    hex:"#ffd23f" },
];

const HATS = [
  { id:"none",       name:"No hat",    price:0,    icon:"🚫" },
  { id:"cap",        name:"Cap",       price:150,  icon:"🧢" },
  { id:"beanie",     name:"Beanie",    price:200,  icon:"🎿" },
  { id:"headband",   name:"Headband",  price:250,  icon:"🎽" },
  { id:"antenna",    name:"Antenna",   price:450,  icon:"📡" },
  { id:"headphones", name:"Headphones",price:500,  icon:"🎧" },
  { id:"crown",      name:"Crown",     price:600,  icon:"👑" },
  { id:"tophat",     name:"Top hat",   price:700,  icon:"🎩" },
  { id:"wizard",     name:"Wizard hat",price:800,  icon:"🧙" },
  { id:"halo",       name:"Halo",      price:1000, icon:"😇" },
];
const TRAILS = [
  { id:"none",    name:"No trail",  price:0,    icon:"🚫" },
  { id:"sparkle", name:"Sparkles",  price:300,  icon:"✨" },
  { id:"bubble",  name:"Bubbles",   price:400,  icon:"🫧" },
  { id:"flame",   name:"Flame",     price:500,  icon:"🔥" },
  { id:"comet",   name:"Comet",     price:700,  icon:"☄️" },
  { id:"rainbow", name:"Rainbow",   price:900,  icon:"🌈" },
];
const GLOWS = [
  { id:"none",   name:"No glow",   price:0,    icon:"🚫" },
  { id:"neon",   name:"Neon rim",  price:400,  icon:"💡" },
  { id:"double", name:"Double ring",price:500, icon:"◎" },
  { id:"pulse",  name:"Pulse",     price:700,  icon:"💫" },
  { id:"aura",   name:"Aura",      price:1000, icon:"🔮" },
];

const PACKS = [
  { id:"rookie", name:"Rookie Pack", price:250, count:1, a:"#2f7bff", b:"#1fd6b0", glow:"#2f7bff", icon:"🎁",
    sub:"One random ability. A cheap way to start a playbook.", odds:{ Common:70, Rare:25, Epic:5, Legendary:0, Mythic:0 } },
  { id:"pro", name:"Pro Pack", price:650, count:2, a:"#7b5cff", b:"#ff5d8f", glow:"#a06bff", icon:"🎁",
    sub:"Two random abilities with a shot at something special.", odds:{ Common:50, Rare:33, Epic:15, Legendary:2, Mythic:0 } },
  { id:"elite", name:"Elite Pack", price:1300, count:3, a:"#ff9d1f", b:"#ff3d81", glow:"#ff7a3d", icon:"🏆",
    sub:"Three abilities. Better odds on Epic, Legendary and Mythic pulls.", odds:{ Common:30, Rare:40, Epic:23, Legendary:6, Mythic:1 } },
  { id:"legend", name:"Legendary Pack", price:2600, count:3, a:"#ffcf3f", b:"#ff5f2b", glow:"#ffb43c", icon:"🌟",
    sub:"Three abilities, no Commons. The best odds available, including Mythic.", odds:{ Common:0, Rare:44, Epic:41, Legendary:12, Mythic:3 } },
];
const SAVE_KEY = "sparkpitch.save.v1";
const DEFAULT_KEYS = {
  p1: { up:"KeyW", down:"KeyS", left:"KeyA", right:"KeyD", kick:"Space", ability1:"KeyE", ability2:"KeyQ", signature:"KeyF" },
  p2: { up:"ArrowUp", down:"ArrowDown", left:"ArrowLeft", right:"ArrowRight", kick:"Enter", ability1:"ShiftRight", ability2:"ControlRight", signature:"Slash" },
};
const ACTION_LABELS = { up:"Move up", down:"Move down", left:"Move left", right:"Move right", kick:"Kick", ability1:"Ability slot 1", ability2:"Ability slot 2", signature:"Signature ability" };
const STARTER_COINS = 500;
const PLAY_MS = [{ at:60, coins:50, label:"1 minute" }, { at:300, coins:150, label:"5 minutes" }, { at:600, coins:300, label:"10 minutes", double:true }];
const MODES = [
  { id:"1v1ai",    name:"1v1 vs AI",       icon:"🤖", note:"One striker each. You against a AI keeper-striker hybrid." },
  { id:"bounce",   name:"Bounce Arena",    icon:"🧱", note:"A pinball pitch crowded with solid walls. Everything rebounds, so the ball never settles." },
  { id:"bouncepvp",name:"Bounce Arena PvP",icon:"🧱", note:"The same walled pinball pitch, but two humans on one keyboard and no AI anywhere." },
  { id:"rush",     name:"Ability Rush",    icon:"♾️", note:"Unlimited mode: every 10 seconds both players are handed two fresh random abilities. Nothing here touches your loadouts — your pack unlocks only apply outside this mode." },
  { id:"rushpvp",  name:"Ability Rush PvP",icon:"♾️", note:"Unlimited 1v1 between two humans: both hands reshuffle every 10 seconds and loadouts sit this one out." },
  { id:"1v1local", name:"1v1 Local",       icon:"🎮", note:"Two humans, opposite teams, one keyboard. Share the laptop and settle it." },
  { id:"2v2ai",    name:"2v2 vs AI",       icon:"👥", note:"You plus an AI teammate take on two AI opponents." },
  { id:"2v2coop",  name:"2v2 Co-op",       icon:"🤝", note:"Two humans on the same team against two AI opponents. Couch co-op." },
  { id:"2v2couch", name:"2v2 Couch Battle",icon:"⚔️", note:"Two humans on opposite teams, each with an AI teammate. Keyboard sharing chaos." },
];
/* Mode families: the same rules apply to the AI version and its local PvP twin,
   so every "is this mode a bounce/rush match?" check goes through these sets. */
const BOUNCE_MODES = new Set(["bounce", "bouncepvp"]);
const RUSH_MODES = new Set(["rush", "rushpvp"]);
/* How the Play screen groups those modes: pick a family, then pick how many humans
   are playing. `mode` points at the concrete entry in MODES above, so every menu,
   HUD label, reward rule and save field keeps working off the same ids. */
const MODE_FAMILIES = [
  { id: "1v1", name: "1v1", icon: "🤖", note: "One striker each.", options: [
    { mode: "1v1ai",      label: "1 Player",  hint: "vs AI" },
    { mode: "1v1local",   label: "2 Players", hint: "share the keyboard" },
  ] },
  { id: "bounce", name: "Bounce Arena", icon: "🧱", note: "A pinball pitch full of walls.", options: [
    { mode: "bounce",     label: "1 Player",  hint: "vs AI" },
    { mode: "bouncepvp",  label: "2 Players", hint: "P1 vs P2" },
  ] },
  { id: "rush", name: "Ability Rush", icon: "♾️", note: "Two random abilities for everyone, every 10 s.", options: [
    { mode: "rush",       label: "1 Player",  hint: "vs AI" },
    { mode: "rushpvp",    label: "2 Players", hint: "P1 vs P2" },
  ] },
  { id: "2v2", name: "2v2", icon: "👥", note: "Two a side, with bots filling the gaps.", options: [
    { mode: "2v2ai",      label: "1 Player",  hint: "you + bot vs 2 bots" },
    { mode: "2v2coop",    label: "2 Players", hint: "P1 + P2 vs 2 bots" },
    { mode: "2v2couch",   label: "Split",     hint: "P1 vs P2, one bot each" },
  ] },
];
const MODE_BY_ID = new Map(MODES.map(m => [m.id, m]));
/* `reward` scales the coins a completed match pays out: beating up Beginner bots
   is the baseline, and every step up the ladder is worth meaningfully more.
   It is applied once to the earned subtotal, before any Double Coins bonus. */
const DIFFICULTY = {
  beginner:{ label:"Beginner",speed:0.58, react:0.85, aim:0.62, ability:0.02, aggro:0.2,  kick:0.55, idle:0.72, reward:1    },
  easy:   { label:"Rookie",  speed:0.82, react:0.42, aim:0.4,  ability:0.2,  aggro:0.65, kick:0.8,  idle:0.32, reward:1.2  },
  normal: { label:"Pro",     speed:0.96, react:0.24, aim:0.22, ability:0.5,  aggro:0.9,  kick:0.95, idle:0.08, reward:1.45 },
  hard:   { label:"All-Star",speed:1.03, react:0.14, aim:0.12, ability:0.72, aggro:1.02, kick:1.02, idle:0.02, reward:1.75 },
  legend: { label:"Legend",  speed:1.09, react:0.08, aim:0.06, ability:0.9,  aggro:1.12, kick:1.06, idle:0,    reward:2.1  },
};

/* ==========================================================================
   SAVE
   ========================================================================== */
function defaultSave() {
  return {
    v: 2,
    coins: STARTER_COINS,
    starterGranted: true,
    shards: 0,
    unlocked: [],
    loadouts: [["",""],["",""]],
    ownedColors: COLORS.map(c => c.id),
    ownedHats: ["none"],
    ownedTrails: ["none"],
    ownedGlows: ["none"],
    look: { color:"#2ee6c5", colorId:"mint", hat:"none", hatColor:"#ff3d81", trail:"none", glow:"none", ballColor:"#f4f8ff" },
    chars: { owned:["pip"], selected:"pip" },
    names: { p1:"P1", p2:"P2" },
    stats: { wins:0, losses:0, draws:0, goals:0, matches:0, packs:0, abilitiesFound:0,
      shotsOnTarget:0, saves:0, coinsEarned:0 },
    audio: { master:0.8, sfx:0.8, crowd:0.5, cheer:0.6, music:0.28, muted:false },
    settings: { aimAssist:true, aimIndicator:true, screenShake:true, visualFx:true, stickyBall:true },
    playtime: { seconds:0, claimed:[false,false,false], cycle:1 },
    doubleCoins: { matchesLeft:0 },
    keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
    ad: { lastAt:0 },
    lastMode: "1v1ai",
    lastDuration: 120,
    lastTarget: 5,
    lastDifficulty: "beginner",
    lastFirstGoal: false,
  };
}
function migrateKeys(raw, defaults) {
  const out = Object.assign({}, defaults);
  if (raw && typeof raw === "object") {
    ["up","down","left","right","kick"].forEach(a => { if (typeof raw[a] === "string") out[a] = raw[a]; });
    out.ability1 = typeof raw.ability1 === "string" ? raw.ability1
      : (typeof raw.ability === "string" ? raw.ability : defaults.ability1);
    out.ability2 = typeof raw.ability2 === "string" ? raw.ability2
      : (typeof raw.swap === "string" ? raw.swap : defaults.ability2);
    out.signature = typeof raw.signature === "string" ? raw.signature : defaults.signature;
  }
  return out;
}
let SAVE = defaultSave();
let storageOK = true;
let saveError = "";
let saveBlocked = false;
let freshSave = false;
function cleanName(value, fallback) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16)
    .trim();
  return cleaned.length ? cleaned : fallback;
}
function num(value, fallback, min, max) {
  const n = Number(value);
  if (!isFinite(n)) return fallback;
  return clamp(n, min == null ? -Infinity : min, max == null ? Infinity : max);
}
function loadSave() {
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (err) {
    storageOK = false;
    saveError = "This browser blocked local storage, so progress cannot be read or saved. The game still works for this session.";
    return;
  }
  if (!raw) { freshSave = true; return; }
  freshSave = false;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Save data is not a valid object");
    const base = defaultSave();
    const merged = Object.assign({}, base, data);
    merged.v = 2;
    merged.coins = Math.round(num(data.coins, data.coins == null ? STARTER_COINS : 0, 0));
    merged.shards = Math.round(num(data.shards, 0, 0));
    merged.starterGranted = true; // existing saves always keep their balance
    merged.unlocked = Array.isArray(data.unlocked) ? data.unlocked.filter(id => !!ABIL_BY_ID[id]) : base.unlocked;
    merged.loadouts = [0,1].map(i => {
      const list = Array.isArray(data.loadouts) && Array.isArray(data.loadouts[i]) ? data.loadouts[i] : [];
      const l = list.map(id => (typeof id === "string" && merged.unlocked.includes(id)) ? id : "");
      while (l.length < 2) l.push("");
      return l.slice(0,2);
    });
    merged.chars = Object.assign({}, base.chars, data.chars || {});
    merged.chars.owned = Array.isArray(data.chars && data.chars.owned)
      ? data.chars.owned.filter(id => !!CHAR_BY_ID[id]) : base.chars.owned.slice();
    if (!merged.chars.owned.includes("pip")) merged.chars.owned.unshift("pip");
    if (!merged.chars.owned.includes(merged.chars.selected)) merged.chars.selected = "pip";
    merged.look = Object.assign({}, base.look, data.look || {});
    if (!merged.look.hatColor) merged.look.hatColor = base.look.hatColor;
    if (!merged.look.ballColor) merged.look.ballColor = base.look.ballColor;
    merged.names = Object.assign({}, base.names, data.names || {});
    merged.names.p1 = cleanName(merged.names.p1, "P1");
    merged.names.p2 = cleanName(merged.names.p2, "P2");
    merged.stats = Object.assign({}, base.stats, data.stats || {});
    merged.audio = Object.assign({}, base.audio, data.audio || {});
    if (data.audio == null && data.settings && typeof data.settings.volume === "number") {
      merged.audio.master = num(data.settings.volume, base.audio.master, 0, 1);
      merged.audio.muted = !!data.settings.muted;
    }
    ["master","sfx","crowd","cheer","music"].forEach(k => { merged.audio[k] = num(merged.audio[k], base.audio[k], 0, 1); });
    merged.audio.muted = !!merged.audio.muted;
    merged.settings = Object.assign({}, base.settings, data.settings || {});
    ["aimAssist","aimIndicator","screenShake","visualFx","stickyBall"].forEach(k => {
      merged.settings[k] = typeof merged.settings[k] === "boolean" ? merged.settings[k] : base.settings[k];
    });
    merged.playtime = Object.assign({}, base.playtime, data.playtime || {});
    merged.playtime.seconds = num(merged.playtime.seconds, 0, 0);
    merged.playtime.cycle = Math.max(1, Math.round(num(merged.playtime.cycle, 1, 1)));
    merged.playtime.claimed = [0,1,2].map(i => !!(data.playtime && Array.isArray(data.playtime.claimed) && data.playtime.claimed[i]));
    merged.doubleCoins = Object.assign({}, base.doubleCoins, data.doubleCoins || {});
    merged.doubleCoins.matchesLeft = Math.round(num(merged.doubleCoins.matchesLeft, 0, 0, 3));
    merged.ad = Object.assign({}, base.ad, data.ad || {});
    merged.keys = {
      p1: migrateKeys(data.keys && data.keys.p1, DEFAULT_KEYS.p1),
      p2: migrateKeys(data.keys && data.keys.p2, DEFAULT_KEYS.p2),
    };
    merged.ownedColors = COLORS.map(c => c.id);
    merged.ownedHats = Array.isArray(data.ownedHats) && data.ownedHats.length ? data.ownedHats : base.ownedHats;
    merged.ownedTrails = Array.isArray(data.ownedTrails) && data.ownedTrails.length ? data.ownedTrails : base.ownedTrails;
    merged.ownedGlows = Array.isArray(data.ownedGlows) && data.ownedGlows.length ? data.ownedGlows : base.ownedGlows;
    if (!DIFFICULTY[merged.lastDifficulty]) merged.lastDifficulty = "beginner";
    if (!MODES.some(m => m.id === merged.lastMode)) merged.lastMode = "1v1ai";
    if (![60,120,180,300].includes(Number(merged.lastDuration))) merged.lastDuration = 120;
    if (![0,3,5,7].includes(Number(merged.lastTarget))) merged.lastTarget = 5;
    replaceSave(merged);
  } catch (err) {
    console.warn("Save load failed", err);
    saveBlocked = true;
    storageOK = false;
    saveError = "Your existing save could not be read, so it has been left untouched and a safe default is being used. Nothing was overwritten — export a copy before making changes if the data matters to you.";
  }
}
function replaceSave(next) {
  for (const key of Object.keys(SAVE)) delete SAVE[key];
  Object.assign(SAVE, next);
}
let lastSavedJSON = "", lastSavedBody = "", onSaved = null;
function persist() {
  if (saveBlocked) return;
  try {
    SAVE.savedAt = Date.now();
    lastSavedJSON = JSON.stringify(SAVE);
    lastSavedBody = saveBody();
    localStorage.setItem(SAVE_KEY, lastSavedJSON);
    storageOK = true;
    saveError = "";
  } catch (err) {
    storageOK = false;
    saveError = "Progress could not be saved — local storage is full or blocked. Your session continues, but it may not survive a refresh.";
    console.warn("Save failed", err);
    return;
  }
  if (onSaved) onSaved();
}

/* ==========================================================================
   AUDIO — all synthesized, no external assets
   ========================================================================== */
/* One audio manager, five independent buses. Every sound is synthesized here —
   there are no external audio files, so a missing asset can never break a match. */
const Sound = {
  ctx: null, master: null, buses: {}, muted: false, adMuted: false, volume: 0.8,
  mix: { master:0.8, sfx:0.8, crowd:0.5, cheer:0.6, music:0.28 },
  crowdSource: null, crowdGain: null, crowdWanted: false,
  musicTimer: null, musicStep: 0,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      ["sfx","crowd","cheer","music"].forEach(name => {
        const g = this.ctx.createGain();
        g.gain.value = this.mix[name];
        g.connect(this.master);
        this.buses[name] = g;
      });
      this.apply();
    } catch (err) { this.ctx = null; }
  },
  bus(name) {
    this.init();
    return this.buses[name] || this.master;
  },
  apply() {
    this.init();
    if (this.master) this.master.gain.value = (this.muted || this.adMuted) ? 0 : clamp(this.mix.master, 0, 1);
    ["sfx","crowd","cheer","music"].forEach(name => {
      const g = this.buses[name];
      if (g) g.gain.value = clamp(this.mix[name], 0, 1);
    });
    if (this.master && !this.muted && this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  },
  setMix(audio) {
    this.mix = {
      // The master fader is gone: volume lives on the individual buses and the
      // single Mute button is the only global switch left.
      master: 1,
      sfx: clamp(audio.sfx, 0, 1),
      crowd: clamp(audio.crowd, 0, 1),
      cheer: clamp(audio.cheer, 0, 1),
      music: clamp(audio.music, 0, 1),
    };
    this.muted = !!audio.muted;
    this.volume = this.mix.master;
    this.apply();
  },
  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    this.startMusic();
  },
  tone(freq, dur, type, gain, slideTo, delay, busName) {
    this.init();
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.14), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.bus(busName || "sfx"));
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  },
  noise(dur, gain, freq, delay, busName, q) {
    this.init();
    if (!this.ctx || this.muted) return null;
    const t0 = this.ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq || 1200;
    filter.Q.value = q == null ? 0.8 : q;
    const g = this.ctx.createGain();
    g.gain.value = gain || 0.2;
    src.connect(filter); filter.connect(g); g.connect(this.bus(busName || "sfx"));
    src.start(t0);
    return src;
  },
  play(name) {
    this.init();
    if (!this.ctx || this.muted) return;
    switch (name) {
      case "click":   this.tone(620, 0.06, "square", 0.05, 880); break;
      case "kick":    this.noise(0.11, 0.26, 900); this.tone(150, 0.15, "sine", 0.22, 60); break;
      case "bigkick": this.noise(0.16, 0.32, 700); this.tone(110, 0.24, "triangle", 0.3, 40); break;
      case "goal":
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.16, null, i * 0.085));
        this.tone(261, 0.5, "sine", 0.1, null, 0.02);
        this.cheer();
        break;
      case "win":
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.26, "triangle", 0.15, null, i * 0.1));
        break;
      case "whistle":
        this.tone(1900, 0.16, "square", 0.07, 2300);
        this.tone(2100, 0.18, "square", 0.05, 1800, 0.19); break;
      case "ability": this.tone(320, 0.22, "sawtooth", 0.09, 980); this.tone(640, 0.16, "sine", 0.07, 1500, 0.04); break;
      case "coin":    this.tone(1180, 0.09, "square", 0.09); this.tone(1560, 0.12, "square", 0.08, null, 0.08); break;
      case "buy":     [392, 523, 659].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.12, null, i * 0.07)); break;
      case "pack":    [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.12, null, i * 0.08)); break;
      case "legend":
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.14, null, i * 0.1));
        this.noise(0.5, 0.1, 3200, 0.1); break;
      case "lose":    [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, "sine", 0.13, null, i * 0.13)); break;
      case "tick":    this.tone(760, 0.05, "square", 0.06); break;
      case "go":      this.tone(1046, 0.22, "square", 0.1, 1568); break;
      case "block":   this.noise(0.1, 0.2, 1800); this.tone(240, 0.1, "square", 0.1); break;
      case "deny":    this.tone(180, 0.12, "square", 0.08, 120); break;
      default: break;
    }
  },
  /* Crowd cheer: one swell + scattered claps on the cheer bus only. */
  cheer() {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this.bus("cheer");
    const t0 = this.ctx.currentTime + 0.02;
    const len = Math.floor(this.ctx.sampleRate * 1.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const band = this.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(420, t0);
    band.frequency.linearRampToValueAtTime(1250, t0 + 0.5);
    band.frequency.linearRampToValueAtTime(700, t0 + 1.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.55, t0 + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.45);
    src.connect(band); band.connect(g); g.connect(bus);
    src.start(t0);
    for (let i = 0; i < 7; i++) {
      const ct = t0 + 0.12 + Math.random() * 0.9;
      const clen = Math.floor(this.ctx.sampleRate * 0.05);
      const cbuf = this.ctx.createBuffer(1, clen, this.ctx.sampleRate);
      const cd = cbuf.getChannelData(0);
      for (let k = 0; k < clen; k++) cd[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / clen, 2);
      const cs = this.ctx.createBufferSource(); cs.buffer = cbuf;
      const cf = this.ctx.createBiquadFilter(); cf.type = "bandpass"; cf.frequency.value = 1500 + Math.random() * 1200;
      const cg = this.ctx.createGain(); cg.gain.value = 0.22;
      cs.connect(cf); cf.connect(cg); cg.connect(bus);
      cs.start(ct);
    }
  },
  startCrowd() {
    this.init();
    if (!this.ctx) return;
    if (this.crowdSource) {
      if (this.crowdGain) this.crowdGain.gain.linearRampToValueAtTime(0.045, this.ctx.currentTime + 0.5);
      return;
    }
    const len = Math.floor(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 620;
    const g = this.ctx.createGain(); g.gain.value = 0.0001;
    src.connect(lp); lp.connect(g); g.connect(this.bus("crowd"));
    src.start();
    g.gain.linearRampToValueAtTime(0.045, this.ctx.currentTime + 0.9);
    this.crowdSource = src; this.crowdGain = g;
  },
  stopCrowd() {
    if (this.ctx && this.crowdGain) this.crowdGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
  },
  startMusic() {
    this.init();
    if (!this.ctx) return;
    // The recorded track takes over whenever its file is present; the synth loop
    // below is only the fallback so a missing asset never leaves the game silent.
    if (Music.play()) return;
    this.startSynthMusic();
  },
  startSynthMusic() {
    this.init();
    if (!this.ctx || this.musicTimer) return;
    const chords = [[220,261.6,329.6],[174.6,220,261.6],[196,246.9,293.7],[164.8,207.6,246.9]];
    const tick = () => {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + 0.05;
      const chord = chords[this.musicStep % chords.length];
      this.musicStep++;
      chord.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.06, t0 + 1.1);
        g.gain.linearRampToValueAtTime(0.0001, t0 + 3.1);
        osc.connect(g); g.connect(this.bus("music"));
        osc.start(t0); osc.stop(t0 + 3.2);
      });
    };
    tick();
    this.musicTimer = setInterval(tick, 3000);
  },
  stopSynthMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  },
  stopMusic() {
    Music.pause();
    this.stopSynthMusic();
  }
};

/* ==========================================================================
   MUSIC — one recorded track, with the synth loop as a safety net
   Every sound effect is still generated in code; only the soundtrack is a file.
   It plays through the same Music bus, so the Music slider and Mute still work,
   and if the file is missing or cannot be decoded the old chord loop takes over.
   ========================================================================== */
const MUSIC_TRACK = "audio/Match Day Adrenaline - usesuno.com.mp3";
const Music = {
  el: null, node: null, failed: false, wanted: false, src: MUSIC_TRACK,
  ensure() {
    if (this.el || this.failed) return this.el;
    const el = document.createElement("audio");
    el.loop = true;
    el.preload = "auto";
    el.src = encodeURI(this.src);
    el.addEventListener("error", () => {
      this.failed = true;
      if (this.wanted) Sound.startSynthMusic();
    });
    Sound.init();
    if (Sound.ctx) {
      try {
        this.node = Sound.ctx.createMediaElementSource(el);
        this.node.connect(Sound.bus("music"));
      } catch (err) { this.node = null; }
    }
    this.el = el;
    return el;
  },
  play() {
    this.wanted = true;
    const el = this.ensure();
    if (!el || this.failed) return false;
    const attempt = el.play();
    if (attempt && attempt.catch) {
      attempt.catch(err => {
        const name = err && err.name;
        // A format/decode problem means the file is unusable: fall back for good.
        // A blocked autoplay is fine — the next gesture calls play() again.
        if (name === "NotSupportedError") { this.failed = true; Sound.startSynthMusic(); }
      });
    }
    Sound.stopSynthMusic();
    return true;
  },
  pause() {
    this.wanted = false;
    if (this.el) { try { this.el.pause(); } catch (err) {} }
  }
};

/* ==========================================================================
   UI STATE + NAVIGATION
   ========================================================================== */
const setup = { mode:"1v1ai", duration:120, target:5, difficulty:"beginner" };
let abilityTabPlayer = 0;
let bindTabPlayer = 0;
let pendingBind = null;
let previewCharId = "pip";
let customTab = "hats";
let customPreview = { colorId:"mint", color:"#2ee6c5", hat:"none", hatColor:"#ff3d81", trail:"none", glow:"none", ballColor:"#f4f8ff" };
let customSelected = null;
let adBusy = false;
const AD_COOLDOWN_MS = 90 * 1000;

const SCREEN_RENDERERS = {
  home: renderHome,
  play: renderPlay,
  collection: renderCollection,
  abilities: renderAbilities,
  shop: renderShop,
  customize: renderCustomize,
  settings: renderSettings,
  match: () => {}
};

/* Navigation guard: a live match can only be left on purpose. Every menu button,
   timer, ability and goal stays on the match screen; only exitMatch()/returnHome()
   move the player back, which kills a whole class of "it just sent me home" bugs. */
function returnHome() {
  if (TUTORIAL.active) {
    TUTORIAL.active = false;
    TUTORIAL.steps = [];
    const bar = $("tutorial-bar");
    if (bar) bar.classList.remove("show");
  }
  if (MATCH.active) exitMatch();
  $("pause-menu").classList.remove("show");
  $("result").classList.remove("show");
  $("pack-overlay").classList.remove("show");
  showScreen("home", { force: true });
}
function showScreen(name, opts) {
  const force = !!(opts && opts.force);
  if (name === "match" && !MATCH.active) name = "home";
  if (MATCH.active && name !== "match" && !force) {
    console.warn("[nav] blocked unexpected exit from match to", name);
    return;
  }
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = $("screen-" + name);
  if (el) el.classList.add("active");
  if (name !== "match") Sound.stopCrowd();
  input = Object.create(null);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  refreshCoins();
  const render = SCREEN_RENDERERS[name];
  if (render) render();
  if (name === "home") drawHomePreview();
}

function refreshCoins() {
  ["home-coins","play-coins","collection-coins","abil-coins","shop-coins","customize-coins"].forEach(id => {
    const el = $(id);
    if (el) el.textContent = fmtCoins(SAVE.coins);
  });
  const shards = $("abil-shards"); if (shards) shards.textContent = SAVE.shards;
  const shopShards = $("shop-shards"); if (shopShards) shopShards.textContent = SAVE.shards;
  syncPackButtons();
}
function syncPackButtons() {
  const grid = $("shop-packs");
  if (!grid || !$("screen-shop").classList.contains("active")) return;
  PACKS.forEach((pack, i) => {
    const card = grid.children[i];
    const btn = card && card.querySelector("button");
    if (btn) btn.disabled = SAVE.coins < pack.price;
  });
}

function selectedCharacter() {
  return CHAR_BY_ID[SAVE.chars.selected] || CHARACTERS[0];
}
function playerName(p) {
  const key = p && p.control === "p2" ? "p2" : "p1";
  return cleanName(SAVE.names && SAVE.names[key], key === "p2" ? "P2" : "P1");
}
function keyLabel(code) {
  if (!code) return "—";
  const special = {
    Space:"Space", Enter:"Enter", Escape:"Esc", Tab:"Tab",
    ShiftRight:"R Shift", ShiftLeft:"L Shift", ControlRight:"R Ctrl", ControlLeft:"L Ctrl",
    ArrowUp:"↑", ArrowDown:"↓", ArrowLeft:"←", ArrowRight:"→",
    Backspace:"Backspace", Comma:",", Period:".", Slash:"/", Semicolon:";", Quote:"'",
    BracketLeft:"[", BracketRight:"]", Backslash:"\\", Minus:"-", Equal:"=", Backquote:"`"
  };
  if (special[code]) return special[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num" + code.slice(6);
  return code;
}

/* ==========================================================================
   HOME
   ========================================================================== */
function renderHome() {
  const char = selectedCharacter();
  $("home-char-name").textContent = char.name;
  $("home-char-bio").textContent = char.bio;
  $("home-wins").textContent = SAVE.stats.wins;
  $("home-goals").textContent = SAVE.stats.goals;
  $("home-shards").textContent = SAVE.shards;
  $("home-abil-count").textContent = SAVE.unlocked.length + " / " + ABILITIES.length + " unlocked";
  // Counted from the mode list itself, so the label can never drift behind it again.
  const numWord = n => ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][n] || n;
  const ways = MODE_FAMILIES.reduce((total, family) => total + family.options.length, 0);
  $("home-play-sub").textContent = numWord(MODE_FAMILIES.length) +
    (MODE_FAMILIES.length === 1 ? " mode, " : " modes, ") + numWord(ways).toLowerCase() + " ways to play";
  $("home-player-label").textContent = SAVE.names.p1;
  $("home-player-line").textContent = "Playing as " + SAVE.names.p1 + " · signature: " +
    (SIGNATURES[char.id] ? SIGNATURES[char.id].name : "none") + ". Change your name in Settings.";
  const dbl = $("home-double");
  if (SAVE.doubleCoins.matchesLeft > 0) {
    dbl.style.display = "inline-flex";
    $("home-double-count").textContent = SAVE.doubleCoins.matchesLeft;
  } else {
    dbl.style.display = "none";
  }
  refreshCoins();
  renderPlaytime();
  drawHomePreview();
}

/* ---------- playtime rewards ---------- */
function renderPlaytime() {
  const pt = SAVE.playtime;
  const clock = $("playtime-clock");
  if (!clock) return;
  clock.textContent = "Cycle " + pt.cycle + " · " + fmtTime(pt.seconds) + " played";
  const nextIdx = pt.claimed.findIndex(c => !c);
  const prevAt = nextIdx > 0 ? PLAY_MS[nextIdx - 1].at : 0;
  const nextAt = nextIdx >= 0 ? PLAY_MS[nextIdx].at : PLAY_MS[PLAY_MS.length - 1].at;
  const pct = nextIdx < 0 ? 100 : clamp((pt.seconds - prevAt) / Math.max(1, nextAt - prevAt), 0, 1) * 100;
  $("playtime-fill").style.width = pct + "%";
  const marks = $("playtime-marks");
  marks.innerHTML = "";
  PLAY_MS.forEach((m, i) => {
    const claimed = pt.claimed[i];
    const ready = !claimed && pt.seconds >= m.at;
    const tile = document.createElement("div");
    tile.className = "pt-mile" + (claimed ? " done" : ready ? " ready" : "");
    const title = document.createElement("b");
    title.textContent = Math.round(m.at / 60) + "m · " + m.coins + (m.double ? " +2×" : "");
    tile.appendChild(title);
    const state = document.createElement("span");
    state.textContent = claimed ? "Claimed ✓" : ready ? "Ready to claim" : fmtTime(Math.max(0, m.at - pt.seconds)) + " to go";
    tile.appendChild(state);
    // The tile is compact, so the full label and countdown live in the tooltip.
    tile.title = m.label + " of active play · " + m.coins + " coins" + (m.double ? " and 3 double-coin matches" : "") + " — " + state.textContent;
    const btn = document.createElement("button");
    btn.className = "btn tiny " + (ready ? "gold" : "ghost");
    btn.textContent = claimed ? "Claimed" : ready ? "Claim " + m.coins : "Locked";
    btn.disabled = !ready;
    btn.addEventListener("click", () => claimPlaytime(i));
    tile.appendChild(btn);
    marks.appendChild(tile);
  });
  let note = nextIdx >= 0
    ? "Next reward at " + PLAY_MS[nextIdx].label + " of active match play. Paused matches, menus and background tabs do not count."
    : "Claim all three milestones to finish this cycle — a fresh one starts immediately afterwards.";
  if (SAVE.doubleCoins.matchesLeft > 0) {
    note += " Double Coins is active for your next " + SAVE.doubleCoins.matchesLeft +
      " completed match" + (SAVE.doubleCoins.matchesLeft === 1 ? "" : "es") + ".";
  }
  $("playtime-note").textContent = note;
}
function claimPlaytime(index) {
  const pt = SAVE.playtime;
  const m = PLAY_MS[index];
  if (!m || pt.claimed[index] || pt.seconds < m.at) return;
  pt.claimed[index] = true;
  SAVE.coins += m.coins;
  SAVE.stats.coinsEarned += m.coins;
  if (m.double) SAVE.doubleCoins.matchesLeft = Math.max(SAVE.doubleCoins.matchesLeft, 3);
  const all = pt.claimed.every(Boolean);
  if (all) {
    pt.claimed = [false, false, false];
    pt.seconds = 0;
    pt.cycle += 1;
  }
  persist();
  refreshCoins();
  renderPlaytime();
  renderHome();
  Sound.play("coin");
  toast("Playtime reward: +" + m.coins + " coins" + (m.double ? " · Double Coins armed for 3 matches" : ""), "good");
  if (m.double) Sound.play("legend");
}
function drawHomePreview() {
  const canvas = $("home-char-canvas");
  if (!canvas) return;
  drawAvatarPreview(canvas, selectedCharacter(), SAVE.look, 1.35);
}

/* ==========================================================================
   PLAY SETUP
   ========================================================================== */
function modeNeedsP2(modeId) {
  return modeId === "1v1local" || modeId === "bouncepvp" || modeId === "rushpvp" ||
    modeId === "2v2coop" || modeId === "2v2couch";
}
function selectMode(modeId) {
  setup.mode = modeId;
  SAVE.lastMode = modeId;
  persist();
  Sound.play("click");
  renderPlay();
}
function renderPlay() {
  setup.mode = MODE_BY_ID.has(setup.mode) ? setup.mode : "1v1ai";
  const grid = $("mode-grid");
  grid.innerHTML = "";
  MODE_FAMILIES.forEach(family => {
    const card = document.createElement("div");
    card.className = "mode-card" + (family.options.some(o => o.mode === setup.mode) ? " selected" : "");
    // Clicking the heading picks the family's first option (1 player) unless the
    // family is already the active one — then it just keeps the current pick.
    const head = document.createElement("button");
    head.type = "button";
    head.className = "mode-head";
    head.innerHTML = `<span class="mode-ico">${family.icon}</span><b>${family.name}</b><small>${family.note}</small>`;
    head.addEventListener("click", () => {
      const current = family.options.some(o => o.mode === setup.mode);
      selectMode(current ? setup.mode : family.options[0].mode);
    });
    card.appendChild(head);
    const row = document.createElement("div");
    row.className = "mode-choice";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", family.name + " — how many players");
    family.options.forEach(option => {
      const chosen = setup.mode === option.mode;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "choice" + (chosen ? " selected" : "");
      chip.dataset.mode = option.mode;
      chip.setAttribute("aria-pressed", String(chosen));
      chip.innerHTML = `<b>${option.label}</b><small>${option.hint}</small>`;
      chip.addEventListener("click", () => selectMode(option.mode));
      row.appendChild(chip);
    });
    card.appendChild(row);
    grid.appendChild(card);
  });
  $("opt-duration").value = String(setup.duration);
  $("opt-target").value = String(setup.target);
  $("opt-difficulty").value = setup.difficulty;
  // No bots, no difficulty: hide the control rather than leave a dead knob showing.
  $("difficulty-field").style.display = AI_MODES.has(setup.mode) ? "" : "none";
  $("opt-firstgoal").value = setup.firstGoal ? "1" : "0";
  $("play-note").textContent = (MODES.find(m => m.id === setup.mode) || MODES[0]).note +
    (modeNeedsP2(setup.mode) ? " Player 2 uses the arrows to move, Enter to kick, R Shift for ability 1 and R Ctrl for ability 2 — remap them in Settings." : "") +
    (AI_MODES.has(setup.mode) ? " Coin payout ×" + ((DIFFICULTY[setup.difficulty] || DIFFICULTY.beginner).reward || 1) + " on this difficulty." : "") +
    (setup.firstGoal ? " First goal wins: the next goal ends the match." : "");
  renderPayoutStrip();
  renderLoadoutPickers();
  refreshCoins();
}
/* One quiet line of coin values, so you know what a goal is worth before you
   kick off without a wall of text during the match. */
function renderPayoutStrip() {
  const el = $("payout-strip");
  if (!el) return;
  const d = DIFFICULTY[setup.difficulty] || DIFFICULTY.beginner;
  const mult = AI_MODES.has(setup.mode) ? (d.reward || 1) : 1;
  const parts = [
    ["Goal", REWARD_TABLE.goal], ["Shot on target", REWARD_TABLE.shotOnTarget],
    ["Save", REWARD_TABLE.save], ["Win", REWARD_TABLE.win],
    ["Loss / draw", REWARD_TABLE.loss], ["Full match", REWARD_TABLE.completion],
  ].map(([k, v]) => `<span>${k} <b>${v}</b></span>`);
  if (mult > 1) parts.push(`<span>× <b>${mult}</b> on ${d.label}</span>`);
  el.innerHTML = `<span class="ps-lead">Coins per match</span>` +
    parts.join('<span class="ps-sep">·</span>');
}
function renderLoadoutPickers() {
  const wrap = $("play-loadouts");
  wrap.innerHTML = "";
  if (RUSH_MODES.has(setup.mode)) {
    // Ability Rush hands out random abilities, so the saved loadouts are moot
    const note = document.createElement("p");
    note.className = "hint";
    note.innerHTML = "<b>Ability Rush</b> hands both players two random abilities every 10 seconds, so these loadout choices sit out this mode. They are untouched — switch to another mode to use them again.";
    wrap.appendChild(note);
    return;
  }
  const humans = modeNeedsP2(setup.mode) ? [0,1] : [0];
  humans.forEach(pi => {
    const block = document.createElement("div");
    block.className = "loadout-block";
    const title = document.createElement("div");
    title.className = "loadout-title";
    title.innerHTML = `<span>Player ${pi+1} loadout <span class="tag ${pi===0?'p1':'p2'}">${pi===0?'WASD':'Arrows'}</span></span>`;
    block.appendChild(title);
    const row = document.createElement("div");
    row.className = "loadout-row";
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = pi === 0 ? "P1" : "P2";
    row.appendChild(who);
    [0,1].forEach(slot => {
      const sel = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = ""; empty.textContent = "— Empty —";
      sel.appendChild(empty);
      SAVE.unlocked.forEach(id => {
        const a = ABIL_BY_ID[id];
        const opt = document.createElement("option");
        opt.value = id; opt.textContent = a.name + " · " + a.rarity;
        sel.appendChild(opt);
      });
      sel.value = SAVE.loadouts[pi][slot] || "";
      sel.addEventListener("change", () => {
        const val = sel.value;
        if (val && SAVE.loadouts[pi][1 - slot] === val) SAVE.loadouts[pi][1 - slot] = "";
        SAVE.loadouts[pi][slot] = val;
        persist();
        Sound.play("click");
        renderLoadoutPickers();
      });
      row.appendChild(sel);
    });
    block.appendChild(row);
    const controls = document.createElement("div");
    controls.className = "hint";
    controls.innerHTML = pi === 0
      ? `<b>${keyLabel(SAVE.keys.p1.kick)}</b> kick · <b>${keyLabel(SAVE.keys.p1.ability1)}</b> slot 1 · <b>${keyLabel(SAVE.keys.p1.ability2)}</b> slot 2`
      : `<b>${keyLabel(SAVE.keys.p2.kick)}</b> kick · <b>${keyLabel(SAVE.keys.p2.ability1)}</b> slot 1 · <b>${keyLabel(SAVE.keys.p2.ability2)}</b> slot 2`;
    block.appendChild(controls);
    wrap.appendChild(block);
  });
  if (SAVE.unlocked.length === 0) {
    const note = document.createElement("p");
    note.className = "hint";
    note.style.marginTop = "4px";
    note.innerHTML = "You have no special abilities yet. Play matches to earn coins, then open a <b>Rookie Pack</b> (250 coins) in the Pack Shop or watch an optional ad for a free one.";
    wrap.appendChild(note);
  }
}

/* ==========================================================================
   PLAYER COLLECTION
   ========================================================================== */
function renderCollection() {
  if (!CHAR_BY_ID[previewCharId]) previewCharId = SAVE.chars.selected;
  const char = CHAR_BY_ID[previewCharId] || CHARACTERS[0];
  const owned = SAVE.chars.owned.includes(char.id);
  const selected = SAVE.chars.selected === char.id;
  $("char-name").textContent = char.name;
  $("char-rarity").textContent = char.rarity + " character";
  $("char-bio").textContent = char.bio;
  $("char-tags").innerHTML = char.tags.map(t => `<span class="pill">${t}</span>`).join("");
  const sig = SIGNATURES[char.id];
  const sigBox = $("char-sig");
  if (sigBox) {
    sigBox.innerHTML = `<p class="eyebrow" style="margin-bottom:6px">Signature ability · ${sig.cd}s cooldown</p>
      <b style="font-size:15px;display:block">${sig.icon} ${sig.name}</b>
      <p class="muted" style="font-size:12px;margin-top:5px">${sig.desc}</p>
      <p class="hint" style="margin-top:6px">Bound to <b>${keyLabel(SAVE.keys.p1.signature)}</b> for Player 1 · <b>${keyLabel(SAVE.keys.p2.signature)}</b> for Player 2. Always available, no pack needed.</p>`;
  }
  const canvas = $("char-preview-canvas");
  const previewLook = Object.assign({}, SAVE.look, { color: char.color });
  drawAvatarPreview(canvas, char, previewLook, 1.5);
  const btn = $("btn-char-action");
  btn.disabled = false;
  if (selected) {
    btn.textContent = "Selected ✓";
    btn.className = "btn wide ghost";
    btn.disabled = true;
  } else if (owned) {
    btn.textContent = "Select " + char.name;
    btn.className = "btn primary wide";
  } else {
    btn.textContent = "Unlock · " + char.price + " coins";
    btn.className = "btn gold wide";
    btn.disabled = SAVE.coins < char.price;
  }

  const grid = $("char-grid");
  grid.innerHTML = "";
  CHARACTERS.forEach(c => {
    const owns = SAVE.chars.owned.includes(c.id);
    const card = document.createElement("div");
    card.className = "card rar-" + (c.rarity === "Legendary" ? "Legendary" : c.rarity === "Epic" ? "Epic" : c.rarity === "Rare" ? "Rare" : "Common") +
      (previewCharId === c.id ? " selected" : "") + (owns ? "" : " locked");
    card.innerHTML = `<span class="rar-label">${c.rarity}</span>
      <div class="card-ico" style="color:${c.color}">●</div>
      <b>${c.name}</b>
      <span class="sub">${owns ? (SAVE.chars.selected === c.id ? "On your team" : "Owned") : c.price + " coins"}</span>
      ${owns ? `<span class="owned">${SAVE.chars.selected === c.id ? "Selected" : "Unlocked"}</span>` : `<span class="price">🪙 ${c.price}</span>`}`;
    card.querySelector(".card-ico").style.textShadow = `0 0 18px ${c.color}`;
    card.addEventListener("click", () => {
      previewCharId = c.id;
      Sound.play("click");
      renderCollection();
    });
    grid.appendChild(card);
  });
  refreshCoins();
}

function buyOrSelectCharacter() {
  const char = CHAR_BY_ID[previewCharId] || CHARACTERS[0];
  const owned = SAVE.chars.owned.includes(char.id);
  if (!owned) {
    if (SAVE.coins < char.price) { toast("Not enough coins for " + char.name, "bad"); Sound.play("deny"); return; }
    SAVE.coins -= char.price;
    SAVE.chars.owned.push(char.id);
    toast(char.name + " joined your collection!", "good");
    Sound.play("buy");
  }
  SAVE.chars.selected = char.id;
  const closest = COLORS.reduce((best, c) => {
    const a = hexToRgb(c.hex), b = hexToRgb(char.color);
    const d = Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2);
    return d < best.d ? { c, d } : best;
  }, { c: COLORS[0], d: Infinity }).c;
  SAVE.look.color = closest.hex;
  SAVE.look.colorId = closest.id;
  if (!SAVE.ownedColors.includes(closest.id)) SAVE.ownedColors.push(closest.id);
  persist();
  renderCollection();
  refreshCoins();
}

/* ==========================================================================
   ABILITIES SCREEN
   ========================================================================== */
function renderAbilities() {
  document.querySelectorAll("[data-abil-player]").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.abilPlayer) === abilityTabPlayer);
  });
  const wrap = $("abil-loadout");
  wrap.innerHTML = "";
  SAVE.loadouts[abilityTabPlayer].forEach((id, slot) => {
    const chip = document.createElement("div");
    chip.className = "loadout-chip";
    const ab = id ? ABIL_BY_ID[id] : null;
    const keys = SAVE.keys[abilityTabPlayer === 1 ? "p2" : "p1"];
    const key = keyLabel(slot === 0 ? keys.ability1 : keys.ability2);
    chip.innerHTML = `<span class="slot">Slot ${slot+1} · ${key}</span><span>${ab ? ab.icon + " " + ab.name : "Empty"}</span>` +
      (ab ? `<span class="x" title="Unequip">✕</span>` : "");
    const x = chip.querySelector(".x");
    if (x) x.addEventListener("click", () => {
      SAVE.loadouts[abilityTabPlayer][slot] = "";
      persist(); Sound.play("click"); renderAbilities();
    });
    wrap.appendChild(chip);
  });
  $("ability-count").textContent = SAVE.unlocked.length + " / " + ABILITIES.length;

  const grid = $("ability-grid");
  grid.innerHTML = "";
  ABILITIES.forEach(ab => {
    const unlocked = SAVE.unlocked.includes(ab.id);
    const inSlot = SAVE.loadouts[abilityTabPlayer].indexOf(ab.id);
    const card = document.createElement("div");
    card.className = "card abil-card rar-" + ab.rarity + (unlocked ? "" : " locked") + (inSlot >= 0 ? " selected" : "");
    card.innerHTML = `<span class="rar-label">${ab.rarity}</span>
      <div class="card-ico">${unlocked ? ab.icon : "🔒"}</div>
      <b>${ab.name}</b>
      <span class="sub">${ab.desc}</span>
      <span class="sub" style="color:#8fa4d4">${ab.cat} · ${ab.cd}s cooldown</span>`;
    if (unlocked) {
      const equip = document.createElement("div");
      equip.className = "equip-slot";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:5px";
      [0,1].forEach(slot => {
        const btn = document.createElement("button");
        btn.className = "btn tiny slot-btn" + (inSlot === slot ? " on" : "");
        const keys = SAVE.keys[abilityTabPlayer === 1 ? "p2" : "p1"];
        const key = keyLabel(slot === 0 ? keys.ability1 : keys.ability2);
        btn.textContent = (inSlot === slot ? "Slot " + (slot+1) + " ✓" : "Slot " + (slot+1)) + " · " + key;
        btn.title = "Bind to slot " + (slot+1) + " (" + key + " in match)";
        btn.addEventListener("click", () => equipAbility(abilityTabPlayer, slot, ab.id));
        row.appendChild(btn);
      });
      equip.appendChild(row);
      card.appendChild(equip);
    } else {
      const note = document.createElement("span");
      note.className = "sub";
      note.style.color = "#ffce7a";
      note.textContent = "Locked — find it in packs";
      card.appendChild(note);
    }
    grid.appendChild(card);
  });
  $("abil-shards").textContent = SAVE.shards;
  refreshCoins();
}
function equipAbility(playerIndex, slot, abilityId) {
  const load = SAVE.loadouts[playerIndex];
  const other = load[1 - slot];
  if (other === abilityId) load[1 - slot] = "";
  load[slot] = abilityId;
  persist();
  Sound.play("click");
  toast("Player " + (playerIndex + 1) + " slot " + (slot + 1) + ": " + ABIL_BY_ID[abilityId].name, "good");
  renderAbilities();
}
function forgeAbility() {
  const cost = 150;
  if (SAVE.shards < cost) { toast("You need 150 shards to forge an ability.", "bad"); Sound.play("deny"); return; }
  const missing = ABILITIES.filter(a => !SAVE.unlocked.includes(a.id));
  if (!missing.length) {
    SAVE.shards -= cost;
    SAVE.coins += 250;
    persist(); refreshCoins(); renderAbilities();
    toast("Every ability owned! Converted shards into 250 coins.", "good");
    Sound.play("coin");
    return;
  }
  SAVE.shards -= cost;
  const ab = pick(missing);
  SAVE.unlocked.push(ab.id);
  persist(); refreshCoins(); renderAbilities();
  Sound.play("pack");
  showAdModal("Forged: " + ab.name, `<p class="sub" style="margin:0">${ab.desc}</p><div class="ad-dev">${ab.icon} <b>${ab.rarity}</b> · ${ab.cat} · ${ab.cd}s cooldown. Equip it in the two slots above.</div>`, "Spark forge", "Nice");
}

/* ==========================================================================
   SHOP + PACK OPENING
   ========================================================================== */
const DUPE_COINS = { Common:40, Rare:90, Epic:180, Legendary:350, Mythic:600 };
const DUPE_SHARDS = { Common:20, Rare:35, Epic:60, Legendary:110, Mythic:180 };
let packOverlayState = null;

function oddsLabel(odds) {
  return RARITIES.filter(r => odds[r] > 0).map(r => r + " " + odds[r] + "%").join(" · ");
}
function renderShop() {
  refreshCoins();
  const grid = $("shop-packs");
  grid.innerHTML = "";
  PACKS.forEach(pack => {
    const el = document.createElement("div");
    el.className = "pack";
    el.style.setProperty("--pack-a", pack.a);
    el.style.setProperty("--pack-b", pack.b);
    el.style.setProperty("--pack-glow", pack.glow);
    el.innerHTML = `<span class="pack-count">${pack.count} ${pack.count === 1 ? "ability" : "abilities"}</span>
      <div class="pack-art" style="--pack-a:${pack.a};--pack-b:${pack.b}">${pack.icon}</div>
      <h4>${pack.name}</h4>
      <p class="pack-sub">${pack.sub}</p>
      <div class="pack-odds">${oddsLabel(pack.odds)}</div>
      <button class="btn ${pack.id === "legend" ? "gold" : "primary"} wide">Open · 🪙 ${pack.price}</button>`;
    const btn = el.querySelector("button");
    btn.disabled = SAVE.coins < pack.price;
    btn.addEventListener("click", () => openPack(pack.id, false));
    grid.appendChild(el);
  });
  updateAdButton();
}
function rollAbilityByRarity(rarity) {
  const pool = ABILITIES.filter(a => a.rarity === rarity);
  return pick(pool.length ? pool : ABILITIES);
}
function rollPack(pack) {
  const results = [];
  for (let i = 0; i < pack.count; i++) {
    const rarity = weightedPick(RARITIES.filter(r => pack.odds[r] > 0).map(r => ({ v: r, w: pack.odds[r] })));
    const ab = rollAbilityByRarity(rarity);
    const isNew = !SAVE.unlocked.includes(ab.id);
    let coins = 0, shards = 0;
    if (isNew) {
      SAVE.unlocked.push(ab.id);
      SAVE.stats.abilitiesFound++;
    } else {
      coins = DUPE_COINS[ab.rarity] || 40;
      shards = DUPE_SHARDS[ab.rarity] || 20;
      SAVE.coins += coins;
      SAVE.shards += shards;
    }
    results.push({ ab, isNew, coins, shards });
  }
  return results;
}
function openPack(packId, free) {
  if (packOverlayState) return; // one purchase at a time: no double charges
  const pack = PACKS.find(p => p.id === packId);
  if (!pack) return;
  if (!free) {
    if (SAVE.coins < pack.price) { toast("Not enough coins — win a match or watch an ad.", "bad"); Sound.play("deny"); return; }
    SAVE.coins -= pack.price;
  }
  SAVE.stats.packs++;
  const results = rollPack(pack);
  persist();
  refreshCoins();
  showPackOverlay(pack, results, free ? "Ad reward · free pack" : "Pack opening");
}
function showPackOverlay(pack, results, badge) {
  packOverlayState = { pack, results, revealed: false };
  $("pack-badge").textContent = badge || "Pack opening";
  $("pack-title").textContent = pack.name;
  $("pack-sub").textContent = "Tap the pack to rip it open.";
  $("btn-pack-collect").style.display = "none";
  const stage = $("pack-stage");
  stage.innerHTML = "";
  const art = document.createElement("div");
  art.className = "pack-burst";
  art.style.setProperty("--pack-a", pack.a);
  art.style.setProperty("--pack-b", pack.b);
  art.textContent = pack.icon;
  art.setAttribute("role", "button");
  art.setAttribute("aria-label", "Open " + pack.name);
  art.addEventListener("click", revealPack);
  stage.appendChild(art);
  $("pack-overlay").classList.add("show");
  Sound.play("click");
}
function revealPack() {
  if (!packOverlayState || packOverlayState.revealed) return;
  packOverlayState.revealed = true;
  const { pack, results } = packOverlayState;
  Sound.play("pack");
  const stage = $("pack-stage");
  const burst = stage.querySelector(".pack-burst");
  if (burst) {
    const colors = [pack.a, pack.b, "#ffcf3f", "#ffffff"];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("span");
      p.className = "pack-pop";
      const size = rand(10, 26);
      p.style.cssText = `width:${size}px;height:${size}px;left:50%;top:50%;background:${pick(colors)};--dx:${rand(-180,180)}px;--dy:${rand(-160,120)}px;opacity:.9`;
      stage.appendChild(p);
    }
    burst.remove();
  }
  const row = document.createElement("div");
  row.className = "pack-reveal-cards";
  results.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "reveal-card rar-" + r.ab.rarity;
    card.style.animationDelay = (i * 0.22) + "s";
    card.innerHTML = `<div class="big-ico">${r.ab.icon}</div>
      <span class="rar" style="color:${RARITY_COLOR[r.ab.rarity]}">${r.ab.rarity}</span>
      <h4>${r.ab.name}</h4>
      ${r.isNew ? `<span class="new">New ability!</span>` : `<span class="dupe">Duplicate<br>+${r.coins} coins · +${r.shards} shards</span>`}`;
    row.appendChild(card);
  });
  stage.appendChild(row);
  const gotLegend = results.some(r => r.ab.rarity === "Legendary" || r.ab.rarity === "Mythic");
  setTimeout(() => Sound.play(gotLegend ? "legend" : "coin"), results.length * 220 + 120);
  $("pack-sub").textContent = results.length === 1 ? "You pulled 1 ability." : "You pulled " + results.length + " abilities.";
  $("btn-pack-collect").style.display = "inline-flex";
  persist();
  refreshCoins();
}
function closePackOverlay() {
  $("pack-overlay").classList.remove("show");
  packOverlayState = null;
  if ($("screen-shop").classList.contains("active")) renderShop();
  if ($("screen-abilities").classList.contains("active")) renderAbilities();
  if ($("screen-home").classList.contains("active")) renderHome();
}

/* ==========================================================================
   REWARDED ADS — real provider detection, explicit dev fallback
   ========================================================================== */
const Ads = {
  provider: null,
  readyPromise: null,
  init() {
    let detected = null;
    if (window.PokiSDK && typeof window.PokiSDK.rewardedBreak === "function") {
      detected = "Poki";
    } else {
      // The CrazyGames SDK throws from its `ad` getter until init() has finished.
      try {
        const cg = window.CrazyGames && window.CrazyGames.SDK;
        if (cg && cg.ad && typeof cg.ad.requestAd === "function") detected = "CrazyGames";
      } catch (e) {}
    }
    if (detected !== this.provider) {
      this.provider = detected;
      this.readyPromise = null;
    }
    return this.provider;
  },
  available() { return !!this.init(); },
  prepare() {
    const provider = this.init();
    if (!provider) return Promise.resolve(false);
    if (this.readyPromise) return this.readyPromise;
    let boot = Promise.resolve();
    try {
      if (provider === "Poki" && typeof window.PokiSDK.init === "function") {
        boot = window.PokiSDK.init();
      } else if (provider === "CrazyGames") {
        boot = CG.init();
      }
    } catch (err) { boot = Promise.reject(err); }
    this.readyPromise = Promise.resolve(boot).then(() => {
      try {
        if (provider === "Poki" && typeof window.PokiSDK.gameLoadingFinished === "function") window.PokiSDK.gameLoadingFinished();
      } catch (e) {}
      return true;
    }).catch(() => false);
    return this.readyPromise;
  },
  playRewarded() {
    const provider = this.provider;
    if (!provider) return Promise.resolve({ completed: false, reason: "unavailable" });
    if (provider === "Poki") {
      try { if (window.PokiSDK.gameplayStop) window.PokiSDK.gameplayStop(); } catch (e) {}
      return Promise.resolve()
        .then(() => window.PokiSDK.rewardedBreak())
        .then(ok => ({ completed: !!ok }))
        .catch(() => ({ completed: false, reason: "error" }))
        .then(res => {
          try { if (window.PokiSDK.gameplayStart) window.PokiSDK.gameplayStart(); } catch (e) {}
          return res;
        });
    }
    return new Promise(resolve => {
      let settled = false;
      const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
      const wasPlaying = CG.playing;
      CG.gameplayStop();
      const done = (value) => {
        if (settled) return;
        CG.setAdMute(false);
        if (wasPlaying) CG.gameplayStart();
        finish(value);
      };
      try {
        window.CrazyGames.SDK.ad.requestAd("rewarded", {
          adStarted: () => CG.setAdMute(true),
          adFinished: () => done({ completed: true }),
          adError: () => done({ completed: false, reason: "error" })
        });
      } catch (err) {
        done({ completed: false, reason: "error" });
      }
      setTimeout(() => done({ completed: false, reason: "timeout" }), 120000);
    });
  },
  showRewarded() {
    return this.prepare().then((ready) => {
      if (!ready) return { completed: false, reason: "error" };
      return this.playRewarded();
    });
  }
};
/* ==========================================================================
   CRAZYGAMES SDK v3 — loading, gameplay start/stop and midgame ads.
   Every call is a quiet no-op when the SDK is absent (local test, other portals).
   ========================================================================== */
const CG = {
  initPromise: null,
  playing: false,
  sdk() { return (window.CrazyGames && window.CrazyGames.SDK) || null; },
  init() {
    if (this.initPromise) return this.initPromise;
    const sdk = this.sdk();
    if (!sdk || typeof sdk.init !== "function") return Promise.resolve(false);
    try { if (sdk.game && sdk.game.loadingStart) sdk.game.loadingStart(); } catch (e) {}
    this.initPromise = Promise.resolve()
      .then(() => sdk.init())
      .then(() => true, () => false)
      .then(ok => {
        try { if (ok && sdk.game && sdk.game.loadingStop) sdk.game.loadingStop(); } catch (e) {}
        return ok;
      });
    return this.initPromise;
  },
  gameplayStart() {
    if (this.playing) return;
    this.playing = true;
    this.init().then(ok => { try { if (ok && this.playing) this.sdk().game.gameplayStart(); } catch (e) {} });
  },
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this.init().then(ok => { try { if (ok && !this.playing) this.sdk().game.gameplayStop(); } catch (e) {} });
  },
  setAdMute(on) {
    Sound.adMuted = !!on;
    Sound.apply();
  },
  /* Runs `next` once the midgame ad has finished (or failed, or none is available). */
  midgame(next) {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      this.setAdMute(false);
      next();
    };
    // An SDK that never finishes init() (wrong domain, blocked, offline) must not freeze the menu.
    const ready = Promise.race([this.init(), new Promise(r => setTimeout(() => r(false), 3000))]);
    ready.then(ok => {
      // The SDK throws from its `ad` getter when ads are unavailable, so every access sits in the try.
      try {
        const ad = ok && this.sdk().ad;
        if (!ad || typeof ad.requestAd !== "function") { done(); return; }
        ad.requestAd("midgame", {
          adStarted: () => this.setAdMute(true),
          adFinished: done,
          adError: done
        });
      } catch (e) { done(); return; }
      setTimeout(done, 60000);
    });
  }
};
CG.init();

/* ==========================================================================
   AUTOSAVE — localStorage is always the primary save, so guests keep their
   progress. When the CrazyGames SDK is live, every save is mirrored to
   SDK.data, which syncs to the player's account when they are logged in.
   ========================================================================== */
const CloudSave = {
  ready: false,
  data() { const sdk = CG.sdk(); return (this.ready && sdk && sdk.data) || null; },
  push() {
    const d = this.data();
    if (!d || !lastSavedJSON) return;
    try { d.setItem(SAVE_KEY, lastSavedJSON); } catch (e) {}
  },
  /* Adopts the account copy when it is newer than this device's copy. */
  pull() {
    const d = this.data();
    if (!d) return;
    let cloud = null;
    try { cloud = JSON.parse(d.getItem(SAVE_KEY)); } catch (e) {}
    const cloudAt = cloud && typeof cloud === "object" ? Number(cloud.savedAt) || 0 : 0;
    if (cloudAt > (Number(SAVE.savedAt) || 0) && !saveBlocked && !(MATCH.active && !MATCH.over)) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(cloud));
        loadSave();
        applySaveToSettings();
        syncSetupFromSave();
        showScreen("home", { force: true });
        toast("Progress synced from your account.", "good");
        return;
      } catch (e) {}
    }
    if (SAVE.savedAt && cloudAt < SAVE.savedAt) this.push();
  },
  start() {
    CG.init().then(ok => { if (!ok) return; this.ready = true; this.pull(); });
  }
};
onSaved = () => CloudSave.push();
/* Saves on a timer and whenever the page is hidden or closed, not just on actions. */
function saveBody() { return JSON.stringify(SAVE, (k, v) => k === "savedAt" ? undefined : v); }
function autosave() {
  if (!saveBlocked && saveBody() !== lastSavedBody) persist();
}
setInterval(autosave, 10000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") autosave(); });
window.addEventListener("pagehide", autosave);

function adCooldownRemaining() {
  return Math.max(0, AD_COOLDOWN_MS - (Date.now() - (SAVE.ad.lastAt || 0)));
}
function updateAdButton() {
  const btn = $("btn-watch-ad");
  const status = $("ad-status");
  const providerEl = $("ad-provider");
  if (!btn || !status) return;
  const remain = adCooldownRemaining();
  Ads.init();
  if (providerEl) providerEl.textContent = Ads.provider ? "Rewarded ad · " + Ads.provider + " detected" : "Rewarded ad · no provider on this build";
  if (adBusy) {
    btn.disabled = true;
    btn.textContent = "⏳ Ad in progress…";
    status.textContent = "Watching";
  } else if (remain > 0) {
    btn.disabled = true;
    btn.textContent = "Reward in " + Math.ceil(remain / 1000) + "s";
    status.textContent = "Cooldown · " + fmtTime(remain / 1000);
  } else {
    btn.disabled = false;
    btn.textContent = "▶ Watch Ad for a Reward";
    status.textContent = Ads.provider ? "Ready" : "Dev build";
  }
  /* The results screen offers one ad per finished match to double its payout. */
  const resultAd = $("btn-result-ad");
  if (resultAd) {
    if (resultAdState.doubled) {
      resultAd.disabled = true;
      resultAd.textContent = "Doubled ✓";
    } else if (adBusy) {
      resultAd.disabled = true;
      resultAd.textContent = "⏳ Ad in progress…";
    } else if (remain > 0) {
      resultAd.disabled = true;
      resultAd.textContent = "Reward in " + Math.ceil(remain / 1000) + "s";
    } else {
      resultAd.disabled = false;
      resultAd.textContent = "▶ Watch Ad · 2× coins";
    }
  }
}
function showAdModal(title, bodyHtml, badge, buttonLabel) {
  $("ad-modal-title").textContent = title;
  $("ad-modal-badge").textContent = badge || "Rewarded ad";
  $("ad-modal-body").innerHTML = bodyHtml;
  $("btn-ad-close").textContent = buttonLabel || "Got it";
  $("ad-modal").classList.add("show");
}
/* What the finished-match ad double is worth. Reset at every kick-off and every
   full-time, so a bonus can only ever be claimed once for the match on screen. */
let resultAdState = { total: 0, doubled: false };

/* Result-screen double: one ad doubles the coins this match just paid, on top of
   whatever the payout already included. The extra lands only when the provider
   reports the ad finished — no fake ads, no free coins. */
function requestResultAd() {
  if (adBusy || !MATCH.over || resultAdState.doubled || resultAdState.total <= 0) return;
  const remain = adCooldownRemaining();
  if (remain > 0) {
    toast("Next reward available in " + Math.ceil(remain / 1000) + "s.", "bad");
    Sound.play("deny");
    return;
  }
  Ads.init();
  if (!Ads.provider) {
    showAdModal(
      "No ad available here",
      `<p class="sub" style="margin:0 0 8px">This is a development build. Sparkpitch looks for a supported rewarded-ad SDK (Poki or CrazyGames) and did not find one, so no advertisement can be shown.</p>
       <div class="ad-dev"><b>Nothing has been doubled.</b> Your match payout already landed in full — doubling is a bonus on top, never a requirement.</div>
       <p class="hint">On a supported platform the real rewarded ad plays here, and the extra coins are added once the provider confirms the ad was completed.</p>`,
      "Development placeholder",
      "Back to results"
    );
    Sound.play("deny");
    return;
  }
  const bonus = resultAdState.total;
  // Identity check: a rematch during the ad replaces the result state, and the
  // coins are still owed, but the fresh result screen must not read as doubled.
  const claim = resultAdState;
  adBusy = true;
  updateAdButton();
  Ads.showRewarded().then(result => {
    adBusy = false;
    if (result.completed) {
      SAVE.ad.lastAt = Date.now();
      SAVE.coins += bonus;
      SAVE.stats.coinsEarned += bonus;
      if (resultAdState === claim) {
        resultAdState.doubled = true;
        applyResultDouble(bonus);
      }
      persist();
      refreshCoins();
      Sound.play("coin");
      toast("Ad reward: +" + bonus + " coins · match payout doubled", "good");
    } else if (result.reason === "unavailable") {
      showAdModal("No ad available", "<p class=\"sub\" style=\"margin:0\">No rewarded advertisement is available right now. Please try again later.</p>", "Rewarded ad", "OK");
    } else {
      showAdModal("Ad did not finish", "<p class=\"sub\" style=\"margin:0\">The advertisement was not completed, so the match coins were not doubled. You can try again in a moment.</p>", "Rewarded ad", "OK");
    }
    updateAdButton();
  }).catch(() => {
    adBusy = false;
    updateAdButton();
    showAdModal("Ad unavailable", "<p class=\"sub\" style=\"margin:0\">Something went wrong loading the ad, so the match coins were not doubled. Please try again later.</p>", "Rewarded ad", "OK");
  });
}

/* The bonus is itemised on the reward list and the total row is restated, so the
   rows above it still add up to the number that actually reached the wallet. */
function applyResultDouble(bonus) {
  const list = $("result-rewards");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "reward-row";
  row.innerHTML = `<span>Ad bonus <span class="rr-note">match payout ×2</span></span><b>+${bonus}</b>`;
  const totalRow = list.querySelector(".reward-total");
  if (!totalRow) { list.appendChild(row); return; }
  list.insertBefore(row, totalRow);
  const value = totalRow.querySelector("b");
  if (value) value.textContent = "+" + (bonus * 2);
}

function requestRewardedAd() {
  if (adBusy) return;
  const remain = adCooldownRemaining();
  if (remain > 0) {
    toast("Next reward available in " + Math.ceil(remain / 1000) + "s.", "bad");
    Sound.play("deny");
    return;
  }
  Ads.init();
  if (!Ads.provider) {
    showAdModal(
      "No ad available here",
      `<p class="sub" style="margin:0 0 8px">This is a development build. Sparkpitch looks for a supported rewarded-ad SDK (Poki or CrazyGames) and did not find one, so no advertisement can be shown.</p>
       <div class="ad-dev"><b>No reward has been granted.</b> Nothing was simulated or faked. Coins, packs and every ability are fully earnable by playing matches and opening packs.</div>
       <p class="hint">When the game is hosted on a supported platform, its real rewarded ad plays here and the reward is granted only after the provider confirms the ad was completed.</p>`,
      "Development placeholder",
      "Back to the game"
    );
    Sound.play("deny");
    return;
  }
  adBusy = true;
  updateAdButton();
  Ads.showRewarded().then(result => {
    adBusy = false;
    if (result.completed) {
      SAVE.ad.lastAt = Date.now();
      persist();
      grantAdReward();
    } else if (result.reason === "unavailable") {
      showAdModal("No ad available", "<p class=\"sub\" style=\"margin:0\">No rewarded advertisement is available right now. Please try again later.</p>", "Rewarded ad", "OK");
    } else {
      showAdModal("Ad did not finish", "<p class=\"sub\" style=\"margin:0\">The advertisement was not completed, so no reward was granted. You can try again in a moment.</p>", "Rewarded ad", "OK");
    }
    updateAdButton();
  }).catch(() => {
    adBusy = false;
    updateAdButton();
    showAdModal("Ad unavailable", "<p class=\"sub\" style=\"margin:0\">Something went wrong loading the ad. No reward was granted — please try again later.</p>", "Rewarded ad", "OK");
  });
}
function grantAdReward() {
  const roll = Math.random();
  Sound.play("legend");
  if (roll < 0.34) {
    const pack = weightedPick([{ v: "rookie", w: 50 }, { v: "pro", w: 30 }, { v: "elite", w: 15 }, { v: "legend", w: 5 }]);
    const packData = PACKS.find(p => p.id === pack);
    $("pack-overlay").classList.remove("show");
    openPack(pack, true);
    toast("Ad reward: a free " + packData.name + "!", "good");
    return;
  }
  if (roll < 0.67) {
    const coins = randInt(120, 340);
    SAVE.coins += coins;
    persist();
    refreshCoins();
    Sound.play("coin");
    showAdModal("Reward: " + coins + " coins", `<div class="ad-dev" style="text-align:center;font-size:18px">🪙 <b>+${coins} coins</b></div><p class="hint">Thanks for watching. Spend them on packs, characters or cosmetics.</p>`, "Ad completed", "Collect");
    renderHomeIfVisible();
    return;
  }
  const ab = pick(ABILITIES);
  const isNew = !SAVE.unlocked.includes(ab.id);
  let dupeLine = "";
  if (isNew) {
    SAVE.unlocked.push(ab.id);
    SAVE.stats.abilitiesFound++;
  } else {
    const coins = DUPE_COINS[ab.rarity] || 40;
    const shards = DUPE_SHARDS[ab.rarity] || 20;
    SAVE.coins += coins; SAVE.shards += shards;
    dupeLine = `<p class="hint">Already owned — converted into <b>+${coins} coins</b> and <b>+${shards} shards</b>.</p>`;
  }
  persist();
  refreshCoins();
  showAdModal("Reward: " + ab.name + (isNew ? " unlocked!" : " (duplicate)"),
    `<div class="ad-dev" style="text-align:center;font-size:17px">${ab.icon} <b>${ab.name}</b><br><span style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${RARITY_COLOR[ab.rarity]}">${ab.rarity} · ${ab.cat}</span></div>
     <p class="sub" style="margin-top:10px">${ab.desc}</p>${dupeLine}`,
    "Ad completed", "Collect");
  renderHomeIfVisible();
}
function renderHomeIfVisible() {
  if ($("screen-home").classList.contains("active")) renderHome();
  if ($("screen-abilities").classList.contains("active")) renderAbilities();
  if ($("screen-collection").classList.contains("active")) renderCollection();
}

/* ==========================================================================
   CUSTOMIZATION
   ========================================================================== */
function cosmeticList(kind) {
  if (kind === "hats") return HATS;
  if (kind === "trails") return TRAILS;
  if (kind === "glow") return GLOWS;
  return COLORS;
}
function ownedList(kind) {
  if (kind === "hats") return SAVE.ownedHats;
  if (kind === "trails") return SAVE.ownedTrails;
  if (kind === "glow") return SAVE.ownedGlows;
  return SAVE.ownedColors;
}
function lookField(kind) {
  return kind === "hats" ? "hat" : kind === "trails" ? "trail" : kind === "glow" ? "glow" : "colorId";
}
function renderCustomize() {
  refreshCoins();
  document.querySelectorAll("[data-custom-tab]").forEach(t => {
    t.classList.toggle("active", t.dataset.customTab === customTab);
  });
  const char = selectedCharacter();
  drawAvatarPreview($("custom-canvas"), char, Object.assign({}, customPreview), 1.5);
  $("custom-name").textContent = char.name + "’s locker";

  const grid = $("custom-grid");
  grid.innerHTML = "";

  if (customTab === "ball") {
    const note = document.createElement("p");
    note.className = "hint";
    note.style.margin = "0 0 12px";
    note.textContent = "Ball colors are free. Pick any colour and it rolls with you into every match.";
    grid.appendChild(note);
    const colorGrid = document.createElement("div");
    colorGrid.className = "color-grid";
    BALL_COLORS.forEach(color => {
      const selected = (customPreview.ballColor || "").toLowerCase() === color.hex.toLowerCase();
      const tile = document.createElement("button");
      tile.className = "cosmetic-tile" + (selected ? " selected" : "");
      tile.style.padding = "8px";
      tile.innerHTML = `<span class="ball-swatch" style="--ball:${color.hex}"></span>
        <b>${color.name}</b><span class="owned">Free</span>`;
      tile.addEventListener("click", () => {
        customPreview.ballColor = color.hex;
        SAVE.look.ballColor = color.hex;
        persist();
        Sound.play("click");
        renderCustomize();
      });
      colorGrid.appendChild(tile);
    });
    grid.appendChild(colorGrid);
    updateCustomBuyBar();
    return;
  }

  const field = lookField(customTab);
  const current = (customTab === "colors")
    ? COLORS.find(c => c.id === SAVE.look.colorId) || COLORS[0]
    : null;
  const activeId = customSelected && customSelected.kind === customTab ? customSelected.id
    : (customTab === "colors" ? (current && current.id) : SAVE.look[field]);

  if (customTab === "colors") {
    const colorGrid = document.createElement("div");
    colorGrid.className = "color-grid";
    COLORS.forEach(color => {
      const tile = document.createElement("button");
      tile.className = "cosmetic-tile" + (activeId === color.id ? " selected" : "");
      tile.style.padding = "8px";
      tile.innerHTML = `<span style="width:100%;aspect-ratio:1;border-radius:10px;background:${color.hex};display:block;border:1px solid rgba(255,255,255,.2)"></span>
        <b>${color.name}</b><span class="owned">Free</span>`;
      tile.addEventListener("click", () => {
        customSelected = { kind: "colors", id: color.id };
        customPreview.colorId = color.id;
        customPreview.color = color.hex;
        Sound.play("click");
        renderCustomize();
      });
      colorGrid.appendChild(tile);
    });
    grid.appendChild(colorGrid);
  } else {
    const items = cosmeticList(customTab);
    const cardGrid = document.createElement("div");
    cardGrid.className = "card-grid";
    items.forEach(item => {
      const owned = ownedList(customTab).includes(item.id);
      const tile = document.createElement("div");
      tile.className = "cosmetic-tile" + (activeId === item.id ? " selected" : "");
      const priceLine = owned ? "Owned" : "🪙 " + item.price;
      tile.innerHTML = `<div class="card-ico" style="width:64px;height:64px;font-size:26px">${item.icon}</div>
        <b>${item.name}</b><span class="${owned ? 'owned' : ''}">${priceLine}</span>`;
      tile.addEventListener("click", () => {
        customSelected = { kind: customTab, id: item.id };
        customPreview[field] = item.id;
        Sound.play("click");
        renderCustomize();
      });
      cardGrid.appendChild(tile);
    });
    grid.appendChild(cardGrid);
    if (customTab === "hats") grid.appendChild(buildHatColorPanel());
  }
  updateCustomBuyBar();
}
function buildHatColorPanel() {
  const panel = document.createElement("div");
  panel.className = "subpanel";
  panel.innerHTML = `<p class="subpanel-title">Hat color · free</p>
    <p class="hint" style="margin:0 0 10px">Buy a hat once — then recolour it as often as you like. No extra coins.</p>`;
  const row = document.createElement("div");
  row.className = "hat-color-grid";
  HAT_COLORS.forEach(hex => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "hat-swatch" + ((customPreview.hatColor || "").toLowerCase() === hex.toLowerCase() ? " selected" : "");
    swatch.style.background = hex;
    swatch.title = "Hat colour " + hex;
    swatch.addEventListener("click", () => {
      customPreview.hatColor = hex;
      SAVE.look.hatColor = hex;
      persist();
      Sound.play("click");
      renderCustomize();
    });
    row.appendChild(swatch);
  });
  panel.appendChild(row);
  return panel;
}
function updateCustomBuyBar() {
  const btn = $("btn-custom-buy");
  const price = $("custom-price");
  if (customTab === "ball") {
    btn.textContent = "Free · visual only";
    btn.disabled = true;
    btn.className = "btn ghost";
    price.textContent = "Free";
    $("custom-desc").textContent = "Ball colour is free and purely visual.";
    $("custom-hint").textContent = "Your ball colour shows in every match — and in the preview beside your character.";
    return;
  }
  const kind = customTab;
  const field = lookField(kind);
  const list = cosmeticList(kind);
  const selectedId = customSelected && customSelected.kind === kind
    ? customSelected.id
    : (kind === "colors" ? SAVE.look.colorId : SAVE.look[field]);
  const item = list.find(i => i.id === selectedId) || list[0];
  const owned = ownedList(kind).includes(item.id);
  const equipped = kind === "colors" ? SAVE.look.colorId === item.id : SAVE.look[field] === item.id;
  if (equipped) {
    btn.textContent = "Equipped ✓";
    btn.disabled = true;
    btn.className = "btn ghost";
    price.textContent = kind === "colors" ? "Free" : "Visual only";
  } else if (owned) {
    btn.textContent = "Equip " + item.name;
    btn.disabled = false;
    btn.className = "btn primary";
    price.textContent = kind === "colors" ? "Free" : "Owned";
  } else {
    btn.textContent = "Unlock · 🪙 " + item.price;
    btn.disabled = SAVE.coins < item.price;
    btn.className = "btn gold";
    price.textContent = SAVE.coins < item.price ? "Need " + (item.price - SAVE.coins) + " more" : "Buy & equip";
  }
  $("custom-desc").textContent = kind === "colors"
    ? item.name + " body colour is free — equip it any time."
    : item.name + (equipped ? " is equipped." : owned ? " is in your locker — equip it free." : " costs " + item.price + " coins.");
  $("custom-hint").textContent = kind === "hats"
    ? "Previewing " + item.name + ". Hat colour is free — scroll down to recolour it."
    : "Previewing " + item.name + ". Cosmetics are visual only.";
}
function applyCustomSelection() {
  const kind = customTab;
  if (kind === "ball") return;
  const field = lookField(kind);
  const list = cosmeticList(kind);
  const selectedId = customSelected && customSelected.kind === kind
    ? customSelected.id
    : (kind === "colors" ? SAVE.look.colorId : SAVE.look[field]);
  const item = list.find(i => i.id === selectedId) || list[0];
  const owned = ownedList(kind).includes(item.id);
  if (!owned) {
    if (item.price > 0 && SAVE.coins < item.price) { toast("Not enough coins for " + item.name, "bad"); Sound.play("deny"); return; }
    if (item.price > 0) SAVE.coins -= item.price;
    if (kind === "hats") SAVE.ownedHats.push(item.id);
    if (kind === "trails") SAVE.ownedTrails.push(item.id);
    if (kind === "glow") SAVE.ownedGlows.push(item.id);
    if (kind === "colors") SAVE.ownedColors.push(item.id);
    Sound.play(item.price > 0 ? "buy" : "click");
    toast(item.name + " unlocked and equipped!", "good");
  } else {
    Sound.play("click");
  }
  if (kind === "colors") {
    SAVE.look.colorId = item.id;
    SAVE.look.color = item.hex;
    customPreview.colorId = item.id;
    customPreview.color = item.hex;
  } else {
    SAVE.look[field] = item.id;
    customPreview[field] = item.id;
  }
  persist();
  renderCustomize();
  refreshCoins();
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */
function renderSettings() {
  document.querySelectorAll("[data-bind-player]").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.bindPlayer) === bindTabPlayer);
  });
  const muteBtn = $("settings-mute");
  if (muteBtn) {
    muteBtn.textContent = SAVE.audio.muted ? "🔇 Unmute all audio" : "🔊 Mute all audio";
    muteBtn.classList.toggle("on", !!SAVE.audio.muted);
  }
  document.querySelectorAll("[data-vol]").forEach(input => {
    const key = input.dataset.vol;
    const pct = Math.round(clamp(SAVE.audio[key] == null ? 0 : SAVE.audio[key], 0, 1) * 100);
    input.value = String(pct);
    const out = document.querySelector(`[data-vol-val="${key}"]`);
    if (out) out.textContent = String(pct);
  });
  document.querySelectorAll("[data-toggle]").forEach(btn => {
    const key = btn.dataset.toggle;
    btn.setAttribute("aria-pressed", SAVE.settings[key] ? "true" : "false");
  });
  const nameP1 = $("name-p1");
  const nameP2 = $("name-p2");
  if (nameP1 && document.activeElement !== nameP1) nameP1.value = SAVE.names.p1;
  if (nameP2 && document.activeElement !== nameP2) nameP2.value = SAVE.names.p2;
  $("save-status").textContent = storageOK
    ? "Saved locally · " + SAVE.stats.matches + " matches played · " + SAVE.stats.packs + " packs opened"
    : "Local storage is unavailable — progress will not survive a refresh.";
  const errBox = $("save-error");
  if (errBox) {
    errBox.style.display = saveError ? "block" : "none";
    errBox.textContent = saveError;
  }
  const table = $("key-table");
  const playerKeys = SAVE.keys[bindTabPlayer === 0 ? "p1" : "p2"];
  table.innerHTML = "<tr><th>Action</th><th>Key</th></tr>";
  Object.keys(ACTION_LABELS).forEach(action => {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td"); td1.textContent = ACTION_LABELS[action];
    const td2 = document.createElement("td");
    const btn = document.createElement("button");
    const listening = pendingBind && pendingBind.player === bindTabPlayer && pendingBind.action === action;
    btn.className = "key-btn" + (listening ? " listening" : "");
    btn.textContent = listening ? "Press a key…" : keyLabel(playerKeys[action]);
    btn.addEventListener("click", () => {
      pendingBind = { player: bindTabPlayer, action };
      $("bind-warning").style.display = "none";
      renderSettings();
    });
    td2.appendChild(btn);
    tr.appendChild(td1); tr.appendChild(td2);
    table.appendChild(tr);
  });
}
function tryBindKey(code) {
  if (!pendingBind) return false;
  if (code === "Escape" || code === "Tab") {
    pendingBind = null;
    renderSettings();
    return true;
  }
  const { player, action } = pendingBind;
  const keyName = bindTabPlayer === 0 ? "p1" : "p2";
  let conflict = null;
  ["p1","p2"].forEach(pk => {
    Object.keys(SAVE.keys[pk]).forEach(act => {
      if (SAVE.keys[pk][act] === code && !(pk === keyName && act === action)) {
        conflict = (pk === "p1" ? "Player 1" : "Player 2") + " · " + ACTION_LABELS[act];
      }
    });
  });
  if (conflict) {
    const warn = $("bind-warning");
    warn.style.display = "block";
    warn.textContent = keyLabel(code) + " is already used for " + conflict + ". Pick another key — movement and ability buttons can never overlap.";
    Sound.play("deny");
    return true;
  }
  SAVE.keys[keyName][action] = code;
  pendingBind = null;
  persist();
  Sound.play("click");
  toast("Bound " + ACTION_LABELS[action] + " to " + keyLabel(code), "good");
  renderSettings();
  return true;
}

/* ==========================================================================
   MATCH ENGINE — world, physics, goals, timer, HUD
   ========================================================================== */
const WORLD = { w: 1440, h: 900 };
const FIELD = { x: 80, y: 70, w: 1280, h: 760 };
const GOAL_H = 190, GOAL_DEPTH = 56, GOAL_MOUTH = { min: 355, max: 545 };
const CX = FIELD.x + FIELD.w / 2, CY = FIELD.y + FIELD.h / 2;
const BALL_R = 11, PLAYER_R = 21, BASE_SPEED = 300, BALL_MAX = 2000;

const MATCH = {
  active: false, paused: false, over: false, state: "idle",
  mode: "1v1ai", config: null, difficulty: "beginner",
  duration: 120, target: 5, timeLeft: 120,
  score: [0, 0], countdown: 3, countdownShown: 0, goHide: 0,
  celebrate: 0, players: [], humans: [], ball: null,
  hud: [], hudAt: 0, lastScorer: -1, kickoffToTeam: null,
  barriers: [], clones: [], magnetPoints: [], pulses: [], ballFakes: [],
  fx: [], particles: [], bonusCoins: 0,
  shots: 0, abilityUses: 0,
  rewardEvents: { goals: 0, shotsOnTarget: 0, saves: 0 },
  pendingShot: null, shotSeq: 0, shakeT: 0, shakeMag: 0,
};
let input = Object.create(null);
let canvasScale = 1;

/* ---------- team / mode helpers ---------- */
function teamName(team) {
  const humans = MATCH.players.filter(p => p.team === team && p.human).map(playerName);
  if (humans.length >= 2) return humans[0] + " + " + humans[1];
  if (humans.length === 1) return humans[0];
  return team === 0 ? "Left" : "Rivals";
}
function modeLabel(mode) {
  const m = MODES.find(x => x.id === mode);
  return m ? m.name : mode;
}
function humansForMatch() {
  return MATCH.humans;
}

/* ---------- setup ---------- */
function buildMatchPlayers(mode) {
  const specs = [];
  const p1Look = Object.assign({}, SAVE.look);
  const p1Char = selectedCharacter();    const human0 = { team: 0, human: true, control: "p1", label: playerName({ control: "p1" }), look: p1Look, face: p1Char.face, sig: SIGNATURES[p1Char.id] || SIGNATURES.pip };
  const p2Preset = { color: "#ffd23f", colorId: "lemon", hat: "cap", trail: "sparkle", glow: "none" };
  const aiMate = { team: 0, human: false, look: { color: "#8ef04a", hat: "beanie", trail: "none", glow: "none" }, face: "happy" };
  const aiA = { team: 1, human: false, look: { color: "#ff6b8b", hat: "headband", trail: "none", glow: "none" }, face: "focused" };
  const aiB = { team: 1, human: false, look: { color: "#ff9e3d", hat: "cap", trail: "none", glow: "none" }, face: "cheeky" };
  const p2Spec = (team) => ({ team, human: true, control: "p2", label: playerName({ control: "p2" }), look: Object.assign({}, p2Preset), face: "spark", sig: SIGNATURES.volt });

  switch (mode) {
    case "1v1local": specs.push(human0, p2Spec(1)); break;
    case "bouncepvp": specs.push(human0, p2Spec(1)); break;
    case "rushpvp": specs.push(human0, p2Spec(1)); break;
    case "2v2ai": specs.push(human0, aiMate, aiA, aiB); break;
    case "2v2coop": specs.push(human0, p2Spec(0), aiA, aiB); break;
    case "2v2couch": specs.push(human0, aiMate, p2Spec(1), aiB); break;
    default: specs.push(human0, aiA); break;
  }
  MATCH.players = specs.map((spec, index) => {
    // Ability Rush ignores loadouts entirely: both players start on random abilities.
  const abilities = RUSH_MODES.has(mode)
      ? [pick(ABILITIES).id, pick(ABILITIES).id]
      : spec.human
        ? (SAVE.loadouts[spec.control === "p2" ? 1 : 0] || []).slice(0, 2)
        : [pick(ABILITIES).id, pick(ABILITIES).id];
    return {
      id: index, team: spec.team, human: !!spec.human, control: spec.control || null, label: spec.label || null,
      pos: { x: CX, y: CY }, vel: { x: 0, y: 0 }, facing: { x: spec.team === 0 ? 1 : -1, y: 0 },
      radius: PLAYER_R, look: spec.look || { color: "#cccccc", hat: "none", trail: "none", glow: "none" },
      face: spec.face || "happy", abilities: abilities.filter(Boolean), sig: spec.sig || null,
      activeSlot: 0, cooldowns: {}, buffs: {}, kickCooldown: 0, kickAnim: 0,
      fakeTimer: 0, fakeDir: null, doubleTimer: 0, doubleDir: null, doublePower: 0,
      aiTimer: 0, aiDir: { x: 0, y: 0 }, aiTarget: null, aiIntent: "idle", aiAbilityClock: rand(1.2, 2.5),
      trailClock: 0, bob: rand(0, TAU),
    };
  });
  MATCH.humans = MATCH.players.filter(p => p.human);
}
function kickoffPositions(count) {
  const p = MATCH.players;
  const set = (pl, x, y) => { if (!pl) return; pl.pos.x = x; pl.pos.y = y; pl.vel.x = 0; pl.vel.y = 0; pl.facing = { x: pl.team === 0 ? 1 : -1, y: 0 }; };
  // Tutorial: the opponent takes a breather in the far corner, clear of the
  // shooting lane, and returns there after every restart so practice stays calm.
  if (MATCH.tutorial && p.length === 2) {
    set(p[0], CX - 200, CY);
    set(p[1], FIELD.x + FIELD.w - 200, CY + 200);
    return;
  }
  if (p.length === 2) {
    set(p[0], CX - 150, CY);
    set(p[1], CX + 150, CY);
    return;
  }
  set(p[0], CX - 200, CY - 80);
  set(p[1], FIELD.x + 300, CY + 60);
  set(p[2], CX + 200, CY + 80);
  set(p[3], FIELD.x + FIELD.w - 300, CY - 60);
}

/* ---------------------------------------------------------------------------
   BOUNCE ARENA — the pinball mode's furniture
   Loose blocks, not a grid: every bumper keeps a real, visible gap from every
   other one and from the pitch edge, but they still cover the whole field above
   and below the goal corridor. They live in MATCH.barriers with no life timer
   (re-laid at every kick-off), which means ball collision, rendering and
   safe-spot validation all keep working. They are solid for players too; the
   temporary Goal Wall ability stays ball-only exactly as it was.
   --------------------------------------------------------------------------- */
const ARENA_GAP = 48;      // clear air between two bumpers, edge to edge
const ARENA_EDGE = 34;     // clear air between a bumper and the pitch wall
function arenaWallGap(a, b) {
  // Edge-to-edge distance: 0 when the rectangles touch or overlap, otherwise the
  // true shortest gap (corner-to-corner included, not just centre distance).
  return Math.hypot(
    Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0),
    Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));
}
function buildArenaWalls(seed) {
  // A fresh seed at every kick-off reshuffles the layout. Placement is best-candidate
  // sampling: each round throws 96 candidate blocks, keeps the one farthest from every
  // bumper already placed, and accepts it only if the whole edge-to-edge gap is clear.
  // That spreads them over the field instead of letting them clump, and makes touching
  // or overlapping blocks impossible rather than merely unlikely.
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const x0 = FIELD.x + ARENA_EDGE, x1 = FIELD.x + FIELD.w - ARENA_EDGE;
  // The goal-to-goal corridor stays empty, so a straight shot still goes in.
  const bands = [
    { y0: FIELD.y + 58, y1: GOAL_MOUTH.min - 26 },
    { y0: GOAL_MOUTH.max + 30, y1: FIELD.y + FIELD.h - 54 },
  ];
  const walls = [];
  for (let round = 0; round < 200; round++) {
    let best = null, bestGap = -1;
    for (let pick = 0; pick < 96; pick++) {
      const w = 44 + Math.floor(rnd() * 65);
      const h = 40 + Math.floor(rnd() * 55);
      const band = bands[rnd() < 0.5 ? 0 : 1];
      if (band.y1 - band.y0 < h || x1 - x0 < w) continue;
      const cand = {
        x: x0 + Math.round(rnd() * (x1 - x0 - w)),
        y: band.y0 + Math.round(rnd() * (band.y1 - band.y0 - h)),
        w, h,
      };
      if (cand.y < band.y0 || cand.y + cand.h > band.y1) continue;
      let gap = Infinity;
      for (const other of walls) gap = Math.min(gap, arenaWallGap(cand, other));
      if (gap > bestGap) { bestGap = gap; best = cand; }
    }
    // Saturated: the widest-open spot left in the field is no longer clear enough.
    if (!best || bestGap < ARENA_GAP) break;
    walls.push(best);
  }
  return walls;
}
function isBounceMode(mode) {
  return BOUNCE_MODES.has(mode || MATCH.mode);
}
function spawnArenaWalls() {
  if (!isBounceMode()) return;
  for (const w of buildArenaWalls((Math.random() * 0xffffffff) >>> 0)) {
    MATCH.barriers.push({ x: w.x, y: w.y, w: w.w, h: w.h,
      life: Infinity, maxLife: Infinity, team: -1, arena: true, color: "#63e0ff" });
  }
}
function resetKickoff(first) {
  const b = MATCH.ball;
  MATCH.miniGoal = null;
  b.pos.x = CX; b.pos.y = CY;
  b.vel.x = 0; b.vel.y = 0;
  b.frozen = 0; b.stick = null; b.stickTimer = 0; b.chaos = 0; b.curve = 0; b.curveTimer = 0;
  b.dribble = null; b.holdGrace = 0; b.noCapture = null; b.noCaptureT = 0;
  b.fire = 0; b.rocket = 0; b.history = []; b.rot = 0; b.spin = 0; b.ice = 0;
  b.electric = 0; b.electricTeam = -1; b.boomerang = null; b.well = null; b.phantom = 0; b.phaseT = 0;
  b.ricochet = 0; b.tornado = 0; b.shieldBall = null; b.quake = null; b.phoenix = null;
  MATCH.pendingShot = null;
  MATCH.barriers.length = 0;
  spawnArenaWalls(); // a fresh set of pinball walls every kick-off
  MATCH.clones.length = 0;
  MATCH.ballFakes.length = 0;
  MATCH.magnetPoints.length = 0;
  MATCH.pulses.length = 0;
  MATCH.fx.length = 0;
  MATCH.particles.length = 0;
  MATCH.players.forEach(p => {
    p.buffs = {};
    // Cooldowns are cleared only when a match starts, never between goals: scoring
    // must not refund a spent ability, or the same power could be spammed every restart.
    if (first) p.cooldowns = {};
    p.kickCooldown = 0; p.fakeTimer = 0; p.doubleTimer = 0;
    p.captureCd = 0;
    p.kickAnim = 0; p.aiTimer = 0; p.activeSlot = 0;
  });
  kickoffPositions(MATCH.players.length);
  // Fair restart: after a goal, roll the ball toward the human who conceded.
  const concedeTeam = MATCH.kickoffToTeam;
  MATCH.kickoffToTeam = null;
  if (!first && concedeTeam != null) {
    const candidates = MATCH.players.filter(p => p.team === concedeTeam && p.human);
    if (candidates.length) {
      const target = candidates.reduce((best, p) =>
        dist(p.pos.x, p.pos.y, CX, CY) < dist(best.pos.x, best.pos.y, CX, CY) ? p : best, candidates[0]);
      const dir = norm(target.pos.x - CX, target.pos.y - CY);
      b.pos.x = CX + dir.x * 26;
      b.pos.y = CY + dir.y * 26;
      b.vel.x = dir.x * 230;
      b.vel.y = dir.y * 230;
      addRing(b.pos.x, b.pos.y, "#ffffff", 12, 54, 0.5);
    }
  }
  MATCH.state = "countdown";
  MATCH.countdown = first ? 3.0 : 2.4;
  MATCH.countdownShown = "";
  MATCH.goHide = 0;
  hideGoalBanner();
  setCountdown(Math.ceil(MATCH.countdown));
}

function startMatch(config) {
  Sound.resume();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  MATCH.config = Object.assign({}, config);
  MATCH.mode = config.mode;
  MATCH.difficulty = config.difficulty || "beginner";
  MATCH.duration = config.duration;
  MATCH.target = config.target || 0;
  MATCH.timeLeft = config.duration;
  MATCH.firstGoal = !!config.firstGoal;
  MATCH.rushTimer = RUSH_INTERVAL;
  MATCH.score = [0, 0];
  MATCH.bonusCoins = 0;
  MATCH.miniGoal = null;
  MATCH.lastScorer = -1;
  MATCH.kickoffToTeam = null;
  MATCH.shots = 0; MATCH.abilityUses = 0;
  MATCH.rewardEvents = { goals: 0, shotsOnTarget: 0, saves: 0 };
  resultAdState = { total: 0, doubled: false };
  MATCH.pendingShot = null; MATCH.shotSeq = 0;
  MATCH.shakeT = 0; MATCH.shakeMag = 0;
  MATCH.active = true; MATCH.paused = false; MATCH.over = false;
  CG.gameplayStart();
  MATCH.tutorial = !!config.tutorial;
  MATCH.celebrate = 0;
  MATCH.ball = { pos: { x: CX, y: CY }, vel: { x: 0, y: 0 }, radius: BALL_R, rot: 0, spin: 0,
    color: SAVE.look.ballColor || "#f4f8ff",
    frozen: 0, chaos: 0, curve: 0, curveTimer: 0, fire: 0, rocket: 0, stick: null, stickTimer: 0,
    dribble: null, holdGrace: 0, noCapture: null, noCaptureT: 0,
    ice: 0, history: [], trailClock: 0, lastTouch: null,
    // expansion-set ability state (see EXPANSION abilities in the data block)
    electric: 0, electricTeam: -1, boomerang: null, well: null, phantom: 0, phaseT: 0,
    ricochet: 0, tornado: 0, shieldBall: null, quake: null, phoenix: null };
  buildMatchPlayers(config.mode);
  if (MATCH.tutorial) {
    // The tutorial hands P1 a fixed pair so the coach can teach them by name.
    // The saved loadout is never touched, so nothing here leaks into real play.
    const p1 = MATCH.players.find(p => p.human);
    if (p1) { p1.abilities = ["power", "dash"]; p1.cooldowns = {}; }
    if (TUTORIAL.active) { TUTORIAL.shots0 = MATCH.shots; TUTORIAL.score0 = MATCH.score[0]; }
  } else {
    // A normal match must never inherit the coach's bar from an abandoned lesson.
    TUTORIAL.active = false;
    TUTORIAL.steps = [];
    const bar = $("tutorial-bar");
    if (bar) bar.classList.remove("show");
  }
  SAVE.lastMode = config.mode; SAVE.lastDuration = config.duration;
  SAVE.lastTarget = config.target; SAVE.lastDifficulty = config.difficulty;
  persist();
  resetKickoff(true);
  $("pause-menu").classList.remove("show");
  $("result").classList.remove("show");
  $("pack-overlay").classList.remove("show");
  $("ad-modal").classList.remove("show");
  $("confirm-modal").classList.remove("show");
  MATCH.hud = [];
  buildMatchHud();
  showScreen("match", { force: true });
  Sound.startCrowd();
  resizeCanvas();
  requestAnimationFrame(resizeCanvas);
  updateMatchHud();
  input = Object.create(null);
  Sound.play("whistle");
}

function exitMatch() {
  CG.gameplayStop();
  MATCH.active = false;
  MATCH.paused = false;
  MATCH.over = false;
  MATCH.state = "idle";
  MATCH.players = [];
  MATCH.ball = null;
  MATCH.humans = [];
  MATCH.miniGoal = null;
  MATCH.kickoffToTeam = null;
  MATCH.barriers.length = 0;
  MATCH.clones.length = 0;
  MATCH.ballFakes.length = 0;
  MATCH.magnetPoints.length = 0;
  MATCH.pulses.length = 0;
  MATCH.fx.length = 0;
  MATCH.particles.length = 0;
  MATCH.pendingShot = null;
  input = Object.create(null);
  Sound.stopCrowd();
}

/* ---------- physics ---------- */
/* Pure intent: the direction the player is actually pointing. Used for dashes,
   blinks and any movement ability, where goal assist must never apply. */
function kickAim(p) {
  const goal = oppGoalCenter(p.team);
  return (p.facing.x || p.facing.y)
    ? norm(p.facing.x, p.facing.y)
    : norm(goal.x - p.pos.x, goal.y - p.pos.y);
}

/* Aim assist: only for human kicks, only when the shot is already inside a
   narrow cone toward the opponent's goal, and only by 5-12 degrees. Anything
   else (clearances, sideways passes, shots at your own net) is untouched. */
const AIM_CONE = 32 * Math.PI / 180;
const AIM_MIN = 5 * Math.PI / 180;
const AIM_MAX = 12 * Math.PI / 180;
function shotAim(p) {
  const base = kickAim(p);
  if (!p.human || !SAVE.settings.aimAssist) return base;
  const attackingHalf = p.team === 0 ? p.pos.x > CX - 140 : p.pos.x < CX + 140;
  if (!attackingHalf) return base;
  const goal = oppGoalCenter(p.team);
  if (dist(p.pos.x, p.pos.y, goal.x, goal.y) > 1150) return base;
  const toGoal = norm(goal.x - p.pos.x, goal.y - p.pos.y);
  const a0 = Math.atan2(base.y, base.x);
  const a1 = Math.atan2(toGoal.y, toGoal.x);
  let diff = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
  if (Math.abs(diff) > AIM_CONE) return base;
  const closeness = 1 - Math.abs(diff) / AIM_CONE;
  let mag = lerp(AIM_MIN, AIM_MAX, clamp(closeness, 0, 1));
  if (p.buffs && p.buffs.ace > 0) mag += 3 * Math.PI / 180;
  const adj = Math.sign(diff) * Math.min(Math.abs(diff), mag);
  const ang = a0 + adj;
  return { x: Math.cos(ang), y: Math.sin(ang) };
}

function updatePlayers(dt) {
  for (const p of MATCH.players) {
    p.kickCooldown = Math.max(0, p.kickCooldown - dt);
    p.captureCd = Math.max(0, (p.captureCd || 0) - dt);
    p.kickAnim = Math.max(0, p.kickAnim - dt);
    p.bob += dt * 3.2;
    for (const key of Object.keys(p.cooldowns)) p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
    for (const key of Object.keys(p.buffs)) {
      p.buffs[key] = Math.max(0, p.buffs[key] - dt);
      if (p.buffs[key] <= 0) delete p.buffs[key];
    }
    p.radius = PLAYER_R + (p.buffs.superblock > 0 ? 14 : 0);

    let dx = 0, dy = 0;
    if (p.human) {
      const keys = SAVE.keys[p.control === "p2" ? "p2" : "p1"];
      if (input[keys.up]) dy -= 1;
      if (input[keys.down]) dy += 1;
      if (input[keys.left]) dx -= 1;
      if (input[keys.right]) dx += 1;
      if (dx || dy) { const n = norm(dx, dy); dx = n.x; dy = n.y; p.facing = { x: dx, y: dy }; }
    } else {
      updateAI(p, dt);
      dx = p.aiDir.x; dy = p.aiDir.y;
    }
    // Reverse Controls scrambles humans and AI alike
    if (p.buffs.reverse > 0) {
      dx = -dx; dy = -dy;
      if (dx || dy) p.facing = { x: dx, y: dy };
    }

    const speedMul = (p.buffs.sprint > 0 ? 1.55 : 1) * (p.buffs.boost > 0 ? 1.32 : 1) *
      (p.buffs.slow > 0 ? 0.5 : 1) * (p.buffs.keeper > 0 ? 1.05 : 1) *
      (p.human ? 1 : (DIFFICULTY[MATCH.difficulty] || DIFFICULTY.normal).speed);
    if (p.buffs.dash > 0) {
      p.buffs.dash = Math.max(0, p.buffs.dash - dt);
    } else {
      const tvx = dx * BASE_SPEED * speedMul, tvy = dy * BASE_SPEED * speedMul;
      const rate = (dx || dy) ? 13 : 9;
      p.vel.x += (tvx - p.vel.x) * Math.min(1, rate * dt);
      p.vel.y += (tvy - p.vel.y) * Math.min(1, rate * dt);
    }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    const minX = FIELD.x + p.radius, maxX = FIELD.x + FIELD.w - p.radius;
    const minY = FIELD.y + p.radius, maxY = FIELD.y + FIELD.h - p.radius;
    if (p.pos.x < minX) { p.pos.x = minX; p.vel.x = Math.max(0, p.vel.x); }
    if (p.pos.x > maxX) { p.pos.x = maxX; p.vel.x = Math.min(0, p.vel.x); }
    if (p.pos.y < minY) { p.pos.y = minY; p.vel.y = Math.max(0, p.vel.y); }
    if (p.pos.y > maxY) { p.pos.y = maxY; p.vel.y = Math.min(0, p.vel.y); }
    // Bounce Arena walls are solid for players as well (pushed out, never inside)
    for (const wall of MATCH.barriers) {
      if (!wall.arena) continue;
      const wx = clamp(p.pos.x, wall.x, wall.x + wall.w);
      const wy = clamp(p.pos.y, wall.y, wall.y + wall.h);
      let ndx = p.pos.x - wx, ndy = p.pos.y - wy;
      const nd = Math.hypot(ndx, ndy);
      if (nd >= p.radius) continue;
      if (nd < 0.001) { ndx = 1; ndy = 0; } else { ndx /= nd; ndy /= nd; }
      p.pos.x = wx + ndx * (p.radius + 0.5);
      p.pos.y = wy + ndy * (p.radius + 0.5);
      const vn = p.vel.x * ndx + p.vel.y * ndy;
      if (vn < 0) { p.vel.x -= vn * ndx; p.vel.y -= vn * ndy; }
    }

    if (p.fakeTimer > 0) {
      p.fakeTimer -= dt;
      if (p.fakeTimer <= 0) executeFakeShot(p);
    }
    if (p.doubleTimer > 0) {
      p.doubleTimer -= dt;
      if (p.doubleTimer <= 0) {
        const b = MATCH.ball;
        if (b && dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) < 300) {
          const dir = p.doubleDir || shotAim(p);
          const extra = (p.doublePower || 640) * 0.95;
          b.vel.x += dir.x * extra;
          b.vel.y += dir.y * extra;
          const sp = Math.hypot(b.vel.x, b.vel.y);
          if (sp > BALL_MAX) { b.vel.x = b.vel.x / sp * BALL_MAX; b.vel.y = b.vel.y / sp * BALL_MAX; }
          b.stick = null;
          b.dribble = null;
          spawnBurst(b.pos.x, b.pos.y, "#ffd23f", 10, 220);
          addRing(b.pos.x, b.pos.y, "#ffd23f", 10, 46, 0.3);
          addText(b.pos.x, b.pos.y - 30, "DOUBLE!", "#ffd23f");
          Sound.play("kick");
          MATCH.shots++;
        }
        p.doubleDir = null;
      }
    }
    if (p.look.trail && p.look.trail !== "none") {
      p.trailClock -= dt;
      if (p.trailClock <= 0 && (Math.abs(p.vel.x) + Math.abs(p.vel.y) > 90)) {
        p.trailClock = 0.05;
        spawnTrailParticle(p);
      }
    }
    // soft player-player collision
    for (const q of MATCH.players) {
      if (q.id <= p.id) continue;
      const d = dist(p.pos.x, p.pos.y, q.pos.x, q.pos.y);
      const min = p.radius + q.radius;
      if (d < min) {
        const n = d > 0.001 ? norm(q.pos.x - p.pos.x, q.pos.y - p.pos.y) : { x: p.team === 0 ? 1 : -1, y: 0 };
        const overlap = (min - d) / 2 + 0.5;
        p.pos.x -= n.x * overlap; p.pos.y -= n.y * overlap;
        q.pos.x += n.x * overlap; q.pos.y += n.y * overlap;
        p.vel.x -= n.x * 40; p.vel.y -= n.y * 40;
        q.vel.x += n.x * 40; q.vel.y += n.y * 40;
      }
    }
  }
}

function circleRectBounce(b, rect, restitution) {
  const cx = clamp(b.pos.x, rect.x, rect.x + rect.w);
  const cy = clamp(b.pos.y, rect.y, rect.y + rect.h);
  let dx = b.pos.x - cx, dy = b.pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= b.radius * b.radius) return false;
  let nx, ny;
  if (d2 > 0.001) {
    const d = Math.sqrt(d2);
    nx = dx / d; ny = dy / d;
    b.pos.x = cx + nx * b.radius;
    b.pos.y = cy + ny * b.radius;
  } else {
    const left = b.pos.x - rect.x, right = rect.x + rect.w - b.pos.x;
    const top = b.pos.y - rect.y, bottom = rect.y + rect.h - b.pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { nx = -1; ny = 0; b.pos.x = rect.x - b.radius; }
    else if (m === right) { nx = 1; ny = 0; b.pos.x = rect.x + rect.w + b.radius; }
    else if (m === top) { nx = 0; ny = -1; b.pos.y = rect.y - b.radius; }
    else { nx = 0; ny = 1; b.pos.y = rect.y + rect.h + b.radius; }
  }
  const vn = b.vel.x * nx + b.vel.y * ny;
  if (vn < 0) {
    const e = restitution == null ? 0.62 : restitution;
    b.vel.x -= (1 + e) * vn * nx;
    b.vel.y -= (1 + e) * vn * ny;
    Sound.play("block");
    spawnBurst(b.pos.x, b.pos.y, "#ffd166", 5, 120);
  }
  return true;
}

/* ---------- possession: the ball sticks to whoever reaches it ----------
   Deliberately not magnetic and not automatic: you must actually reach the
   ball, and only when the relative speed is sane. A rocket, a lightning shot
   or a hard clearance all land well past CAPTURE_REL and still blow straight
   through a defender, so blocking a real shot stays earned. */
const CAPTURE_REL = 640;
/* The Bounce Arena makes a moving ball far harder to trap: only a slow one can be
   collected, so free balls keep ricocheting between the bumpers instead of being
   picked up every time a body touches them. */
const BOUNCE_CAPTURE_REL = 320;
function canCapture(p, b) {
  if (!SAVE.settings.stickyBall) return false;
  if (MATCH.state !== "playing" || MATCH.paused) return false;
  if (b.dribble || b.stick || b.frozen > 0) return false;
  if ((p.captureCd || 0) > 0) return false;
  if (b.noCapture === p && b.noCaptureT > 0) return false;
  const limit = isBounceMode() ? BOUNCE_CAPTURE_REL : CAPTURE_REL;
  return Math.hypot(b.vel.x - p.vel.x, b.vel.y - p.vel.y) < limit;
}
function captureBall(p, b, steal) {
  b.dribble = p;
  b.holdGrace = steal ? 0.22 : 0.16;
  b.noCapture = null; b.noCaptureT = 0;
  b.lastTouch = p;
  spawnBurst(b.pos.x, b.pos.y, p.team === 0 ? "#ff8ad8" : "#2ee6c5", steal ? 10 : 6, 150);
}
function releaseBall(b) {
  if (!b) return;
  b.dribble = null; b.holdGrace = 0;
}
function updateBall(dt) {
  const b = MATCH.ball;
  if (!b) return;
  b.holdGrace = Math.max(0, b.holdGrace - dt);
  b.noCaptureT = Math.max(0, b.noCaptureT - dt);
  // expansion-set timers
  b.electric = Math.max(0, b.electric - dt);
  b.phantom = Math.max(0, b.phantom - dt);
  b.phaseT = Math.max(0, b.phaseT - dt);
  if (b.well) { b.well.t -= dt; if (b.well.t <= 0) b.well = null; }
  if (b.tornado) { b.tornado.t -= dt; if (b.tornado.t <= 0) b.tornado = null; }
  if (b.shieldBall) { b.shieldBall.t -= dt; if (b.shieldBall.t <= 0) b.shieldBall = null; }
  if (b.phoenix) { b.phoenix.t -= dt; if (b.phoenix.t <= 0) b.phoenix = null; }
  if (b.quake) { b.quake.t -= dt; if (b.quake.t <= 0) b.quake = null; }
  if (b.dribble && (!SAVE.settings.stickyBall || MATCH.players.indexOf(b.dribble) < 0)) releaseBall(b);
  if (MATCH.pendingShot) {
    MATCH.pendingShot.life -= dt;
    if (MATCH.pendingShot.life <= 0) MATCH.pendingShot = null;
  }
  b.trailClock -= dt;
  if (b.trailClock <= 0) {
    b.trailClock = 0.035;
    b.history.push({ x: b.pos.x, y: b.pos.y, t: MATCH.timeLeft });
    if (b.history.length > 30) b.history.shift();
  }
  if (b.frozen > 0) {
    b.frozen -= dt;
    releaseBall(b); // an ice-stopped ball is knocked out of anybody's feet
    b.vel.x *= Math.pow(0.02, dt);
    b.vel.y *= Math.pow(0.02, dt);
    b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt;
    constrainBall();
    return;
  }
  /* Carried ball: it rides just in front of the holder in the direction they
     face, so it is always in kick range, it can never be shoved over either
     goal line (no accidental own goals, no walking the ball into the net)
     and a defender must genuinely get to it to win it back. */
  if (b.dribble) {
    const h = b.dribble;
    b.lastTouch = h;
    const fx = h.facing ? h.facing.x : 0, fy = h.facing ? h.facing.y : 0;
    const n = (fx || fy) ? norm(fx, fy) : { x: h.team === 0 ? 1 : -1, y: 0 };
    const off = h.radius + b.radius - 2;
    const tx = clamp(h.pos.x + n.x * off, FIELD.x + b.radius, FIELD.x + FIELD.w - b.radius);
    const ty = clamp(h.pos.y + n.y * off, FIELD.y + b.radius, FIELD.y + FIELD.h - b.radius);
    const k = Math.min(1, 26 * dt);
    b.pos.x += (tx - b.pos.x) * k;
    b.pos.y += (ty - b.pos.y) * k;
    b.vel.x = h.vel.x; b.vel.y = h.vel.y;
    b.rot += Math.hypot(h.vel.x, h.vel.y) * dt / b.radius * 0.6;
    b.boomerang = null; // you have the ball back: no need for the return arc
    if (b.holdGrace <= 0) {
      for (const q of MATCH.players) {
        if (q === h || q.team === h.team) continue;
        if ((q.captureCd || 0) > 0) continue;
        if (dist(q.pos.x, q.pos.y, b.pos.x, b.pos.y) < q.radius + b.radius + 1) {
          b.noCapture = h; b.noCaptureT = 0.45; // the loser cannot instantly re-grab it
          captureBall(q, b, true);
          Sound.play("block");
          break;
        }
      }
    }
    return;
  }
  if (b.stick) {
    const s = b.stick;
    b.stickTimer -= dt;
    const off = s.radius + b.radius + 4;
    const aim = shotAim(s);
    b.pos.x = s.pos.x + aim.x * off;
    b.pos.y = s.pos.y + aim.y * off;
    b.vel.x = s.vel.x; b.vel.y = s.vel.y;
    b.rot += 6 * dt;
    if (b.stickTimer <= 0) {
      b.stick = null;
      b.vel.x = aim.x * 560 + s.vel.x * 0.2;
      b.vel.y = aim.y * 560 + s.vel.y * 0.2;
      spawnBurst(b.pos.x, b.pos.y, "#ff8ad8", 10, 170);
    }
    return;
  }
  // magnets from abilities
  for (const mp of MATCH.magnetPoints) {
    const d = dist(mp.x, mp.y, b.pos.x, b.pos.y);
    if (d > 6) {
      const n = norm(mp.x - b.pos.x, mp.y - b.pos.y);
      b.vel.x += n.x * mp.force * dt;
      b.vel.y += n.y * mp.force * dt;
    }
  }
  for (const p of MATCH.players) {
    if (p.buffs.gravity > 0) {
      const d = dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y);
      if (d < 280 && d > 1) {
        const n = norm(p.pos.x - b.pos.x, p.pos.y - b.pos.y);
        b.vel.x += n.x * 620 * dt;
        b.vel.y += n.y * 620 * dt;
      }
    }
    if (p.buffs.magnetboots > 0) {
      const d = dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y);
      if (d < 200 && d > 1) {
        const n = norm(p.pos.x - b.pos.x, p.pos.y - b.pos.y);
        b.vel.x += n.x * 360 * dt;
        b.vel.y += n.y * 360 * dt;
      }
    }
    // Gravity Ball: the ball drags opponents toward it
    if (b.well && b.well.team !== p.team) {
      const d = dist(b.pos.x, b.pos.y, p.pos.x, p.pos.y);
      if (d < 310 && d > 1) {
        const n = norm(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
        p.vel.x += n.x * 430 * dt;
        p.vel.y += n.y * 430 * dt;
      }
    }
    // Tornado Ball: the whirlwind shoves opponents off the ball as it travels
    if (b.tornado && b.tornado.team !== p.team) {
      const d = dist(b.pos.x, b.pos.y, p.pos.x, p.pos.y);
      if (d < 125 && d > 1) {
        const n = norm(p.pos.x - b.pos.x, p.pos.y - b.pos.y);
        p.vel.x += n.x * 760 * dt;
        p.vel.y += n.y * 760 * dt;
      }
    }
  }
  // Boomerang Ball: after a short run the ball is reeled back to the marked spot
  if (b.boomerang) {
    b.boomerang.t -= dt;
    if (b.boomerang.delay > 0) b.boomerang.delay -= dt;
    else if (b.boomerang.t > 0) {
      const n = norm(b.boomerang.ax - b.pos.x, b.boomerang.ay - b.pos.y);
      b.vel.x += n.x * 1350 * dt;
      b.vel.y += n.y * 1350 * dt;
      if (SAVE.settings.visualFx && Math.random() < dt * 26) {
        MATCH.particles.push({ x: b.pos.x, y: b.pos.y, vx: rand(-40, 40), vy: rand(-40, 40),
          life: 0.4, maxLife: 0.4, size: rand(3, 6), color: pick(["#7bffcf", "#ffffff", "#2ee6c5"]), drag: 0.94 });
      }
    }
    if (b.boomerang.t <= 0) b.boomerang = null;
  }
  if (b.curveTimer > 0 && Math.hypot(b.vel.x, b.vel.y) > 60) {
    b.curveTimer -= dt;
    const n = norm(-b.vel.y, b.vel.x);
    b.vel.x += n.x * b.curve * dt;
    b.vel.y += n.y * b.curve * dt;
  }
  if (b.chaos > 0) {
    b.chaos -= dt;
    if (Math.random() < dt * 7) {
      b.vel.x += rand(-150, 150);
      b.vel.y += rand(-150, 150);
      spawnBurst(b.pos.x, b.pos.y, "#ff5f5f", 3, 120);
    }
  }
  if (b.fire > 0) {
    b.fire -= dt;
    if (Math.random() < dt * 32) spawnBallFire(b);
  }
  if (b.rocket > 0) b.rocket -= dt;
  // keeper auto-save
  for (const p of MATCH.players) {
    if (p.buffs.keeper <= 0) continue;
    const ownGoalX = p.team === 0 ? FIELD.x : FIELD.x + FIELD.w;
    const dGoal = dist(b.pos.x, b.pos.y, ownGoalX, CY);
    const dPlayer = dist(b.pos.x, b.pos.y, p.pos.x, p.pos.y);
    const approaching = (p.team === 0 && b.vel.x < -60) || (p.team === 1 && b.vel.x > 60);
    if (dGoal < 330 && dPlayer < 104 && approaching) {
      const n = norm(b.pos.x - p.pos.x || (p.team === 0 ? 1 : -1), b.pos.y - p.pos.y);
      b.vel.x = n.x * 880; b.vel.y = n.y * 880;
      spawnBurst(b.pos.x, b.pos.y, "#7bffcf", 14, 240);
      addText(p.pos.x, p.pos.y - 40, "SAVE!", "#7bffcf");
      Sound.play("block");
      countSave(p);
    }
  }
  if (b.ice > 0) {
    b.ice -= dt;
    const chill = Math.pow(0.4, dt);
    b.vel.x *= chill; b.vel.y *= chill;
  }
  // friction + integration — the Bounce Arena barely slows the ball down
  const decay = Math.pow(isBounceMode() ? 0.93 : 0.54, dt);
  b.vel.x *= decay; b.vel.y *= decay;
  const sp = Math.hypot(b.vel.x, b.vel.y);
  if (sp > BALL_MAX) { b.vel.x = b.vel.x / sp * BALL_MAX; b.vel.y = b.vel.y / sp * BALL_MAX; }
  if (sp > 5) {
    b.rot += (b.vel.x * dt) / b.radius;
  }
  b.pos.x += b.vel.x * dt;
  b.pos.y += b.vel.y * dt;

  // barrier collision — in the Bounce Arena the walls are springy bumpers
  for (const wall of MATCH.barriers) {
    const hit = circleRectBounce(b, wall, isBounceMode() ? 0.97 : 0.7);
    if (hit && isBounceMode()) {
      const sp = Math.hypot(b.vel.x, b.vel.y);
      // a bumper never lets the ball die: it pings it away at a floor speed
      const boost = Math.max(Math.min(sp * 1.22, BALL_MAX), 560);
      if (sp > 1) {
        b.vel.x = b.vel.x / sp * boost;
        b.vel.y = b.vel.y / sp * boost;
      } else {
        const n = norm(b.pos.x - (wall.x + wall.w / 2), b.pos.y - (wall.y + wall.h / 2));
        b.vel.x = n.x * boost; b.vel.y = n.y * boost;
      }
      spawnBurst(b.pos.x, b.pos.y, wall.arena ? "#63e0ff" : "#ffb46b", 10, 200);
      addRing(b.pos.x, b.pos.y, wall.arena ? "#63e0ff" : "#ffb46b", 10, 44, 0.28);
      MATCH.shakeT = Math.max(MATCH.shakeT, 0.06);
      MATCH.shakeMag = Math.max(MATCH.shakeMag, 2);
    }
  }

  // player-ball collisions — reaching a loose ball now wins possession instead
  // of punching it away (that shove is what used to fire balls into your own net)
  for (const p of MATCH.players) {
    if (b.dribble) break;
    if (b.phantom > 0 || b.phaseT > 0) break; // Phantom Ball / a spent block phases through players
    const d = dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y);
    const min = p.radius + b.radius;
    if (d < min) {
      if (b.stick === p) continue;
      const pvx = b.vel.x, pvy = b.vel.y;
      const shielded = b.shieldBall && p.team !== b.shieldBall.team;
      if (!shielded && canCapture(p, b)) {
        const shot = MATCH.pendingShot;
        captureBall(p, b, false);
        if (shot && p.team === shot.defendingTeam) countSave(p);
        continue;
      }
      const n = d > 0.001 ? norm(b.pos.x - p.pos.x, b.pos.y - p.pos.y) : norm(p.facing.x || 1, p.facing.y || 0);
      if (shielded) {
        // Shield Ball: the opponent's touch barely dents the ball's momentum
        b.pos.x = p.pos.x + n.x * min;
        b.pos.y = p.pos.y + n.y * min;
        b.vel.x = pvx * 0.92; b.vel.y = pvy * 0.92;
        b.shieldBall = null;                     // it takes exactly one touch
        b.phaseT = Math.max(b.phaseT, 0.14);     // and cannot hold the ball in place
        p.captureCd = Math.max(p.captureCd || 0, 0.45);
        spawnBurst(b.pos.x, b.pos.y, "#4fb3ff", 10, 170);
        addRing(b.pos.x, b.pos.y, "#4fb3ff", 12, 48, 0.3);
        continue;
      }
      b.pos.x = p.pos.x + n.x * min;
      b.pos.y = p.pos.y + n.y * min;
      const toward = Math.max(0, p.vel.x * n.x + p.vel.y * n.y);
      const boost = 70 + toward * 0.85 + (p.buffs.superblock > 0 ? 120 : 0);
      b.vel.x = b.vel.x * 0.35 + n.x * boost + p.vel.x * 0.22;
      b.vel.y = b.vel.y * 0.35 + n.y * boost + p.vel.y * 0.22;
      if (b.vel.x * n.x + b.vel.y * n.y < 60) { b.vel.x += n.x * 60; b.vel.y += n.y * 60; }
      b.lastTouch = p;
      if (MATCH.pendingShot && p.team === MATCH.pendingShot.defendingTeam) countSave(p);
      // Thunder Shot: whoever the ball strikes is briefly shocked stiff
      if (b.electric > 0 && b.electricTeam >= 0 && p.team !== b.electricTeam) {
        b.electric = 0;
        p.buffs.slow = Math.max(p.buffs.slow || 0, 1);
        addRing(p.pos.x, p.pos.y, "#c9f0ff", 12, 56, 0.35);
        spawnBurst(p.pos.x, p.pos.y, "#c9f0ff", 12, 190);
        addText(p.pos.x, p.pos.y - 40, "SHOCKED", "#c9f0ff");
      }
      // Phoenix Shot: a blocked shot rebounds once instead of dying on the spot
      if (b.phoenix && p.team !== b.phoenix.team) {
        const shooter = b.phoenix.team;
        b.phoenix = null;
        const sp = Math.hypot(pvx, pvy);
        const dir = sp > 1 ? { x: pvx / sp, y: pvy / sp } : norm(oppGoalCenter(shooter).x - b.pos.x, oppGoalCenter(shooter).y - b.pos.y);
        const rebound = Math.max(sp * 0.85, 950);
        b.vel.x = dir.x * rebound;
        b.vel.y = dir.y * rebound;
        b.phaseT = Math.max(b.phaseT, 0.2); // it burns through the block, then can be blocked again
        b.fire = Math.max(b.fire, 1);
        addText(b.pos.x, b.pos.y - 32, "PHOENIX!", "#ff8f3d");
        spawnBurst(b.pos.x, b.pos.y, "#ff8f3d", 18, 260);
      }
      if (b.quake) fireQuake(b);
    }
  }
  constrainBall();
}
function constrainBall() {
  const b = MATCH.ball;
  if (!b) return;
  const r = b.radius;
  if (b.pos.y < FIELD.y + r) { b.pos.y = FIELD.y + r; b.vel.y = Math.abs(b.vel.y) * ballBounce(b, b.vel.y < -50); }
  if (b.pos.y > FIELD.y + FIELD.h - r) { b.pos.y = FIELD.y + FIELD.h - r; b.vel.y = -Math.abs(b.vel.y) * ballBounce(b, b.vel.y > 50); }
  const inMouth = b.pos.y > GOAL_MOUTH.min && b.pos.y < GOAL_MOUTH.max;
  if (!inMouth) {
    if (b.pos.x < FIELD.x + r) { b.pos.x = FIELD.x + r; b.vel.x = Math.abs(b.vel.x) * ballBounce(b, b.vel.x < -50); }
    if (b.pos.x > FIELD.x + FIELD.w - r) { b.pos.x = FIELD.x + FIELD.w - r; b.vel.x = -Math.abs(b.vel.x) * ballBounce(b, b.vel.x > 50); }
  } else {
    // side walls behind the goal mouths: same bounce rules
    if (b.pos.x < FIELD.x - GOAL_DEPTH + r && b.vel.x < -50) b.vel.x = Math.abs(b.vel.x) * ballBounce(b, true);
    if (b.pos.x > FIELD.x + FIELD.w + GOAL_DEPTH - r && b.vel.x > 50) b.vel.x = -Math.abs(b.vel.x) * ballBounce(b, true);
  }
  // absolute failsafe: never permanently outside the arena
  b.pos.x = clamp(b.pos.x, FIELD.x - GOAL_DEPTH + r, FIELD.x + FIELD.w + GOAL_DEPTH - r);
  b.pos.y = clamp(b.pos.y, FIELD.y + r, FIELD.y + FIELD.h - r);
}

/* ---------- kicking ---------- */
function applyKickImpulse(p, b, dir, power, opts) {
  b.stick = null; b.stickTimer = 0;
  b.dribble = null; b.holdGrace = 0;
  // the kicker cannot instantly re-trap their own kick — shots have to travel
  p.captureCd = 0.42;
  b.vel.x = dir.x * power + p.vel.x * 0.18;
  b.vel.y = dir.y * power + p.vel.y * 0.18;
  const sp = Math.hypot(b.vel.x, b.vel.y);
  if (sp > BALL_MAX) { b.vel.x = b.vel.x / sp * BALL_MAX; b.vel.y = b.vel.y / sp * BALL_MAX; }
  b.lastTouch = p;
  if (opts.curve) { b.curve = opts.curve; b.curveTimer = 1.3; }
  if (opts.fire) { b.fire = 1.5; }
  if (opts.rocket) { b.rocket = 1.4; b.fire = 1.4; }
  spawnBurst(b.pos.x, b.pos.y, opts.color || "#ffffff", 8, 200);
  addRing(b.pos.x, b.pos.y, opts.color || "#ffffff", 10, 58, 0.28);
  Sound.play(power > 1250 ? "bigkick" : "kick");
  if (power > 1250) { MATCH.shakeT = Math.max(MATCH.shakeT, 0.18); MATCH.shakeMag = Math.max(MATCH.shakeMag, 4); }
  registerShotOnTarget(p, power);
}

/* A shot on target = a kick whose straight line would cross the goal mouth.
   Used for the 15-coin reward and to know when a defender has made a real save. */
function registerShotOnTarget(p, power) {
  const b = MATCH.ball;
  if (!b || MATCH.state !== "playing") return;
  const speed = Math.hypot(b.vel.x, b.vel.y);
  if (speed < 380 || Math.abs(b.vel.x) < 120) return;
  const goalX = p.team === 0 ? FIELD.x + FIELD.w : FIELD.x;
  const t = (goalX - b.pos.x) / b.vel.x;
  if (!isFinite(t) || t <= 0 || t > 2.5) return;
  const yAtGoal = b.pos.y + b.vel.y * t;
  if (yAtGoal < GOAL_MOUTH.min + 8 || yAtGoal > GOAL_MOUTH.max - 8) return;
  const id = ++MATCH.shotSeq;
  MATCH.pendingShot = { id, byTeam: p.team, defendingTeam: 1 - p.team, life: 2.6 };
  if (p.team === 0 && p.human) {
    MATCH.rewardEvents.shotsOnTarget++;
    SAVE.stats.shotsOnTarget++;
  }
}
function playerKick(p) {
  if (MATCH.state !== "playing" || MATCH.paused) return;
  const b = MATCH.ball;
  p.kickAnim = 0.2;
  if (!b) return;
  if (p.kickCooldown > 0) return;
  p.kickCooldown = 0.34;
  const reach = p.radius + b.radius + 40 + (p.buffs.superblock > 0 ? 10 : 0);
  if (p.fakeTimer > 0) { p.fakeTimer = 0; }
  // Holding the ball always counts as being in range: press kick, it kicks.
  const held = b.dribble === p;
  if (!held && dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) > reach) {
    Sound.play("click");
    return;
  }
  let power = 790;
  let opts = { color: "#ffffff" };
  const aim = shotAim(p);
  if (p.buffs.power > 0) { power *= 1.62; p.buffs.power = 0; opts.color = "#ff8f3d"; addText(p.pos.x, p.pos.y - 46, "POWER!", "#ff8f3d"); }
  if (p.buffs.flame > 0) { power *= 1.28; p.buffs.flame = 0; opts.fire = true; opts.color = "#ff6a2b"; }
  if (p.buffs.rocket > 0) { power = 1850; p.buffs.rocket = 0; opts.rocket = true; opts.color = "#ffb43c"; addText(p.pos.x, p.pos.y - 46, "ROCKET!", "#ffb43c"); }
  if (p.buffs.curve > 0) {
    p.buffs.curve = 0;
    opts.curve = (p.team === 0 ? 1 : -1) * 620;
    opts.color = "#57d6ff";
    power = 840;
  }
  if (p.buffs.lightning > 0) { p.buffs.lightning = 0; power = 1750; opts.color = "#aef2ff"; opts.fire = false; }
  if (b.frozen > 0) { b.frozen = 0; power *= 0.82; }
  if (p.buffs.ace > 0) {
    p.buffs.ace = 0;
    power *= 1.18;
    opts.color = "#ffd23f";
    addText(p.pos.x, p.pos.y - 46, "PERFECT STRIKE", "#ffd23f");
  }
  /* Expansion set — every one of these loads this kick only. */
  let portalArmed = false, cloneArmed = false, sonicArmed = false;
  if (p.buffs.thunder > 0) {
    p.buffs.thunder = 0;
    power = Math.max(power, 1450);
    opts.color = "#c9f0ff";
    b.electric = 1.6; b.electricTeam = p.team;
    addText(p.pos.x, p.pos.y - 46, "THUNDER!", "#c9f0ff");
  }
  if (p.buffs.boomerang > 0) {
    p.buffs.boomerang = 0;
    opts.color = "#7bffcf";
    b.boomerang = { t: 1.9, delay: 0.4, ax: p.pos.x, ay: p.pos.y, team: p.team };
  }
  if (p.buffs.ricochet > 0) { p.buffs.ricochet = 0; opts.color = "#ffd479"; b.ricochet = 1; }
  if (p.buffs.cloneshot > 0) { p.buffs.cloneshot = 0; opts.color = "#c7a6ff"; cloneArmed = true; }
  if (p.buffs.portal > 0) { p.buffs.portal = 0; opts.color = "#ff4d6d"; portalArmed = true; }
  if (p.buffs.phoenix > 0) {
    p.buffs.phoenix = 0;
    opts.fire = true; opts.color = "#ff8f3d";
    b.phoenix = { t: 3, team: p.team };
  }
  if (p.buffs.gravityball > 0) { p.buffs.gravityball = 0; opts.color = "#a06bff"; b.well = { t: 2.2, team: p.team }; }
  if (p.buffs.phantom > 0) { p.buffs.phantom = 0; opts.color = "#c9b6ff"; b.phantom = 1.7; }
  if (p.buffs.tornado > 0) { p.buffs.tornado = 0; opts.color = "#9fd0ff"; b.tornado = { t: 3, team: p.team }; }
  if (p.buffs.shieldball > 0) { p.buffs.shieldball = 0; opts.color = "#4fb3ff"; b.shieldBall = { t: 4, team: p.team }; }
  if (p.buffs.quake > 0) { p.buffs.quake = 0; opts.color = "#ffb46b"; b.quake = { t: 6, team: p.team }; }
  if (p.buffs.sonic > 0) { p.buffs.sonic = 0; opts.color = "#63e0ff"; sonicArmed = true; }
  if (b.stick === p) { b.stick = null; b.stickTimer = 0; }
  if (!p.human) {
    const d = DIFFICULTY[MATCH.difficulty] || DIFFICULTY.normal;
    power *= d.kick == null ? 1 : d.kick;
  }
  applyKickImpulse(p, b, aim, power, opts);
  if (cloneArmed) spawnBallFakes(p, b, aim, power);
  if (sonicArmed) {
    pushPlayersAway(b.pos.x, b.pos.y, p.team, 250, 600, 0.7, "#63e0ff");
    addRing(b.pos.x, b.pos.y, "#63e0ff", 18, 250, 0.5, 6);
    addText(b.pos.x, b.pos.y - 32, "SONIC BOOM!", "#63e0ff");
  }
  if (portalArmed) portalJump(p, b);
  MATCH.shots++;
  p.stats = p.stats || { shots: 0, goals: 0 };
  p.stats.shots++;
  if (p.buffs.double > 0) {
    p.buffs.double = 0;
    p.doubleTimer = 0.17;
    p.doubleDir = aim;
    p.doublePower = power * 0.82;
    addText(p.pos.x, p.pos.y - 30, "DOUBLE", "#ffd23f");
  }
  if (b.fire > 0) spawnBurst(b.pos.x, b.pos.y, "#ff8f3d", 10, 220);
}
function executeFakeShot(p) {
  const b = MATCH.ball;
  if (!b) return;
  const reach = p.radius + b.radius + 60;
  const aim = p.fakeDir || shotAim(p);
  if (dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) <= reach) {
    applyKickImpulse(p, b, aim, 940, { color: "#d3a0ff" });
    MATCH.shots++;
    addText(p.pos.x, p.pos.y - 42, "SURPRISE!", "#d3a0ff");
  }
  p.fakeDir = null;
}

/* ---------- ability helpers used by engine ---------- */
function useAbilitySlot(p, slot) {
  if (MATCH.state !== "playing" || MATCH.paused) return;
  slot = slot === 1 ? 1 : 0;
  p.activeSlot = slot;
  const id = p.abilities[slot];
  if (!id) { addText(p.pos.x, p.pos.y - 40, "EMPTY SLOT " + (slot + 1), "#93a3cf"); updateAbilityHud(); return; }
  if ((p.cooldowns[id] || 0) > 0) {
    addText(p.pos.x, p.pos.y - 40, Math.ceil(p.cooldowns[id]) + "s", "#ff8f8f");
    Sound.play("deny");
    updateAbilityHud();
    return;
  }
  activateAbility(p, id);
  updateAbilityHud();
}

/* ---------------------------------------------------------------------------
   ABILITY RUSH — unlimited mode
   Every 10 seconds each player is handed two fresh random abilities, drawn from
   the whole pool whether or not they own them. This lives only in the match:
   SAVE.loadouts is never touched, so the rush build cannot leak into any other
   mode and nothing bought from packs is spent or changed.
   --------------------------------------------------------------------------- */
const RUSH_INTERVAL = 10;
function grantRushAbilities(quiet) {
  const pool = ABILITIES.map(a => a.id);
  for (const p of MATCH.players) {
    const a1 = pick(pool);
    let a2 = pick(pool);
    for (let i = 0; i < 8 && a2 === a1; i++) a2 = pick(pool);
    p.abilities = [a1, a2];
    p.cooldowns[a1] = 0;
    p.cooldowns[a2] = 0;
    p.activeSlot = 0;
    if (quiet) continue;
    addText(p.pos.x, p.pos.y - 54, "NEW ABILITIES", "#9fd0ff");
    addRing(p.pos.x, p.pos.y, "#9fd0ff", 18, 74, 0.5);
    spawnBurst(p.pos.x, p.pos.y, "#9fd0ff", 10, 170);
    if (p.human) Sound.play("ability");
  }
  updateAbilityHud();
}

/* ---------- character signatures ---------- */
function useSignature(p) {
  if (MATCH.state !== "playing" || MATCH.paused || !p.sig) return;
  const sig = p.sig;
  if ((p.cooldowns[sig.id] || 0) > 0) {
    addText(p.pos.x, p.pos.y - 40, Math.ceil(p.cooldowns[sig.id]) + "s", "#ff8f8f");
    Sound.play("deny");
    updateAbilityHud();
    return;
  }
  const usesBefore = MATCH.abilityUses;
  if (activateSignature(p, sig)) {
    p.cooldowns[sig.id] = sig.cd;
    if (MATCH.abilityUses === usesBefore) MATCH.abilityUses++; // custom signatures are not counted inside activateAbility
    Sound.play("ability");
    addRing(p.pos.x, p.pos.y, sig.color, p.radius + 4, p.radius + 52, 0.42, 3);
    updateAbilityHud();
  }
}
function activateSignature(p, sig) {
  if (MATCH.state !== "playing" || MATCH.paused) return false;
  const b = MATCH.ball;
  if (!b) return false;
  const pass = { chargeKey: sig.id, cd: sig.cd };
  switch (sig.mech) {
    case "sprint":  return activateAbility(p, "sprint", pass);
    case "blink":   return activateAbility(p, "blink", pass);
    case "shield":  return activateAbility(p, "shield", pass);
    case "guard":   return activateAbility(p, "shield", pass);
    case "dash":    return activateAbility(p, "dash", pass);
    case "power":   return activateAbility(p, "power", pass);
    case "flame":   return activateAbility(p, "flame", pass);
    case "decoy":   return activateAbility(p, "clone", pass);
    case "roar": {
      for (const q of MATCH.players) {
        if (q.team === p.team) continue;
        if (dist(q.pos.x, q.pos.y, p.pos.x, p.pos.y) > 230) continue;
        if (q.buffs.shield > 0) { addRing(q.pos.x, q.pos.y, "#4fb3ff", 14, 52, 0.35); continue; }
        const n = norm(q.pos.x - p.pos.x, q.pos.y - p.pos.y);
        q.vel.x += n.x * 520; q.vel.y += n.y * 520;
        q.buffs.slow = Math.max(q.buffs.slow || 0, 0.5);
        spawnBurst(q.pos.x, q.pos.y, "#48e08a", 9, 170);
      }
      if (dist(b.pos.x, b.pos.y, p.pos.x, p.pos.y) < 210) {
        const n = norm(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
        b.vel.x = n.x * 560; b.vel.y = n.y * 560;
        b.stick = null; b.dribble = null;
      }
      addRing(p.pos.x, p.pos.y, "#48e08a", 20, 230, 0.55, 7);
      addText(p.pos.x, p.pos.y - 46, "ROAR!", "#48e08a");
      MATCH.shakeT = 0.22; MATCH.shakeMag = 4;
      return true;
    }
    case "pull": {
      MATCH.magnetPoints.push({ x: p.pos.x, y: p.pos.y, life: 1.3, maxLife: 1.3, force: 920, color: sig.color, team: p.team });
      addRing(p.pos.x, p.pos.y, sig.color, 18, 180, 0.5);
      addText(p.pos.x, p.pos.y - 46, "MAGNETIC PULL", sig.color);
      return true;
    }
    case "pulsepull": {
      const n = kickAim(p);
      const x = clamp(p.pos.x + n.x * 150, FIELD.x + 30, FIELD.x + FIELD.w - 30);
      const y = clamp(p.pos.y + n.y * 150, FIELD.y + 30, FIELD.y + FIELD.h - 30);
      MATCH.magnetPoints.push({ x, y, life: 1.2, maxLife: 1.2, force: 820, color: sig.color, team: p.team });
      addRing(x, y, sig.color, 10, 90, 0.45);
      addBeam(p.pos.x, p.pos.y, x, y, sig.color, 0.28);
      addText(p.pos.x, p.pos.y - 46, "GRAVITY PULSE", sig.color);
      return true;
    }
    case "ldash": {
      const n = kickAim(p);
      p.vel.x = n.x * 880; p.vel.y = n.y * 880;
      p.buffs.dash = 0.24;
      MATCH.fx.push({ type: "dash", x: p.pos.x, y: p.pos.y, dx: n.x, dy: n.y, life: 0.26, maxLife: 0.26, color: sig.color });
      spawnBurst(p.pos.x, p.pos.y, sig.color, 15, 260);
      addText(p.pos.x, p.pos.y - 44, "LIGHTNING DASH", sig.color);
      return true;
    }
    case "ice": {
      if (dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) > 360) {
        addText(p.pos.x, p.pos.y - 42, "GET CLOSER", "#ff8f8f");
        return false;
      }
      b.ice = 1.7;
      b.frozen = Math.max(b.frozen, 0.22);
      addRing(b.pos.x, b.pos.y, "#9fe6ff", 12, 96, 0.6);
      spawnBurst(b.pos.x, b.pos.y, "#9fe6ff", 20, 200);
      addText(b.pos.x, b.pos.y - 34, "ICE STOP", "#9fe6ff");
      return true;
    }
    case "ace": {
      p.buffs.ace = 6;
      addRing(p.pos.x, p.pos.y, "#ffd23f", 16, 64, 0.45);
      addText(p.pos.x, p.pos.y - 46, "PERFECT STRIKE READY", "#ffd23f");
      return true;
    }
    default: return false;
  }
}

/* ---------- goal / timer / end ---------- */
function checkGoal() {
  if (MATCH.state !== "playing") return;
  const b = MATCH.ball;
  if (b.pos.y < GOAL_MOUTH.min || b.pos.y > GOAL_MOUTH.max) return;
  if (b.pos.x < FIELD.x - 8) scoreGoal(1);
  else if (b.pos.x > FIELD.x + FIELD.w + 8) scoreGoal(0);
}
/* A save pays only for YOUR defensive stop: an opponent's shot, heading for your
   goal, stopped near your own goal line. The opponent saving your shot never
   pays you, body contact up at midfield is not a save, and you never get paid
   for blocking a shot your own team took. */
const SAVE_ZONE = 430; // px from your goal line
function countSave(p) {
  const shot = MATCH.pendingShot;
  if (!shot) return;
  MATCH.pendingShot = null;
  if (!p || !p.human || p.team !== 0) return;
  if (shot.byTeam === p.team) return;                 // never reward stopping your own shot
  const ownGoalX = p.team === 0 ? FIELD.x : FIELD.x + FIELD.w;
  if (Math.abs(p.pos.x - ownGoalX) > SAVE_ZONE) return; // must be defending your own goal
  // You have to actually be playing: a ball bouncing into a player who is not
  // moving is the opponent's shot, not your save.
  if (Math.hypot(p.vel.x || 0, p.vel.y || 0) < 40) return;
  MATCH.rewardEvents.saves++;
  SAVE.stats.saves++;
  addText(p.pos.x, p.pos.y - 48, "SAVE +10", "#7bffcf");
}
function scoreGoal(team) {
  if (MATCH.state === "goal" || MATCH.state === "over") return;
  MATCH.score[team]++;
  MATCH.state = "goal";
  MATCH.celebrate = 2.0;
  MATCH.lastScorer = team;
  MATCH.pendingShot = null;
  if (team === 0) MATCH.rewardEvents.goals++;
  MATCH.shakeT = 0.4; MATCH.shakeMag = 7;
  const b = MATCH.ball;
  b.vel.x = 0; b.vel.y = 0; b.stick = null; b.frozen = 0; b.ice = 0;
  b.dribble = null; b.holdGrace = 0;
  const scorer = b.lastTouch && b.lastTouch.team === team ? b.lastTouch : null;
  if (scorer) { scorer.stats = scorer.stats || { shots: 0, goals: 0 }; scorer.stats.goals++; }
  const name = teamName(team);
  const banner = $("goal-banner");
  banner.querySelector("b").textContent = "GOAL!";
  banner.querySelector("span").textContent = name + (name === "You" ? " score" : " scores") + " · " + MATCH.score[0] + " – " + MATCH.score[1];
  banner.classList.add("show");
  Sound.play("goal");
  const gx = team === 0 ? FIELD.x + FIELD.w - 22 : FIELD.x + 22;
  const inward = team === 0 ? -1 : 1;
  // Confetti stays clustered around the goal that was just scored on.
  for (let i = 0; i < (SAVE.settings.visualFx ? 32 : 0); i++) {
    MATCH.particles.push({
      x: gx + rand(-26, 26),
      y: clamp(CY + rand(-100, 100), FIELD.y + 20, FIELD.y + FIELD.h - 20),
      vx: inward * rand(20, 180) + rand(-45, 45),
      vy: rand(-220, 40),
      life: rand(0.9, 1.5), maxLife: 1.5, size: rand(3, 6),
      color: pick(["#ffcf3f", "#ff3d81", "#2ee6c5", "#ffffff", "#a06bff"]),
      gravity: 520, drag: 0.985, confetti: true, rot: rand(0, TAU), vr: rand(-9, 9)
    });
  }
  spawnBurst(gx, CY, team === 0 ? "#ff3d81" : "#2ee6c5", 10, 170);
  addRing(gx, CY, team === 0 ? "#ff3d81" : "#2ee6c5", 24, 115, 0.55, 5);
  MATCH.kickoffToTeam = 1 - team;
  MATCH.goHide = 0;
  updateMatchHud();
}
function hideGoalBanner() { $("goal-banner").classList.remove("show"); }
function setCountdown(text) {
  const el = $("countdown");
  const span = el.querySelector("span");
  el.classList.add("show");
  if (text === "GO!") { span.textContent = "GO!"; Sound.play("go"); }
  else span.textContent = String(text);
  span.style.animation = "none";
  void span.offsetWidth;
  span.style.animation = "";
}
function hideCountdown() { $("countdown").classList.remove("show"); }

function stepMatch(dt) {
  // fixed sub-steps keep fast shots from tunnelling through players
  let remaining = dt;
  let guard = 0;
  while (remaining > 0.00001 && guard++ < 12) {
    const step = Math.min(1 / 120, remaining);
    stepMatchOnce(step);
    remaining -= step;
    if (!MATCH.active || MATCH.paused || MATCH.over) break;
  }
}
function stepMatchOnce(dt) {
  MATCH.shakeT = Math.max(0, MATCH.shakeT - dt);
  if (MATCH.state === "countdown") {
    MATCH.countdown -= dt;
    const n = Math.ceil(MATCH.countdown);
    if (n > 0) { if (String(n) !== MATCH.countdownShown) { MATCH.countdownShown = String(n); setCountdown(n); Sound.play("tick"); } }
    else if (MATCH.countdownShown !== "GO!") {
      MATCH.countdownShown = "GO!";
      setCountdown("GO!");
      MATCH.state = "playing";
      MATCH.goHide = 0.4;
    }
    updateVisuals(dt, true);
    updateMatchHud();
    return;
  }
  if (MATCH.goHide > 0) {
    MATCH.goHide -= dt;
    if (MATCH.goHide <= 0) hideCountdown();
  }
  if (MATCH.state === "goal") {
    MATCH.celebrate -= dt;
    updateVisuals(dt, true);
    if (MATCH.celebrate <= 0) {
      hideGoalBanner();
      if (MATCH.firstGoal) { endMatch("firstgoal"); return; }
      if (MATCH.target > 0 && MATCH.score[MATCH.lastScorer] >= MATCH.target) { endMatch("target"); return; }
      resetKickoff(false);
    }
    updateMatchHud();
    return;
  }
  if (MATCH.state !== "playing") return;

  // The tutorial clock is frozen: you learn at your own pace, not on a timer.
  if (!MATCH.tutorial) {
    MATCH.timeLeft = Math.max(0, MATCH.timeLeft - dt);
    if (MATCH.timeLeft <= 0) { endMatch("time"); return; }
  }

  if (RUSH_MODES.has(MATCH.mode)) {
    MATCH.rushTimer -= dt;
    if (MATCH.rushTimer <= 0) { MATCH.rushTimer = RUSH_INTERVAL; grantRushAbilities(); }
  }
  updatePlayers(dt);
  updateBall(dt);
  updateVisuals(dt, false);
  checkMiniGoalHit();
  checkGoal();
  updateMatchHud();
}

function miniGoalForTeam(team) {
  const attackingRight = team === 0;
  return {
    x: attackingRight ? FIELD.x + FIELD.w - 300 : FIELD.x + 170,
    y: CY + rand(-120, 120),
    w: 120, h: 96, team, life: 10, used: false, pulse: 0,
  };
}
function checkMiniGoalHit() {
  const mg = MATCH.miniGoal;
  if (!mg || mg.used) return;
  const b = MATCH.ball;
  if (b.pos.x > mg.x - mg.w / 2 && b.pos.x < mg.x + mg.w / 2 &&
      b.pos.y > mg.y - mg.h / 2 && b.pos.y < mg.y + mg.h / 2) {
    mg.used = true;
    const bonus = 30;
    MATCH.bonusCoins += bonus;
    SAVE.coins += bonus;
    persist();
    addText(mg.x, mg.y, "+30 BONUS!", "#ffcf3f");
    spawnBurst(mg.x, mg.y, "#ffcf3f", 26, 340);
    Sound.play("coin");
    refreshCoins();
    mg.life = Math.min(mg.life, 1.6);
  }
}

function updateVisuals(dt, frozenPhysics) {
  for (let i = MATCH.particles.length - 1; i >= 0; i--) {
    const p = MATCH.particles[i];
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= p.drag != null ? p.drag : 0.98;
    p.vy = p.vy * (p.drag != null ? p.drag : 0.98) + (p.gravity || 0) * dt;
    if (p.confetti) p.rot = (p.rot || 0) + (p.vr || 0) * dt;
    if (p.life <= 0) MATCH.particles.splice(i, 1);
  }
  for (let i = MATCH.fx.length - 1; i >= 0; i--) {
    const f = MATCH.fx[i];
    f.life -= dt;
    if (f.vy) f.y += f.vy * dt;
    if (f.life <= 0) MATCH.fx.splice(i, 1);
  }
  for (let i = MATCH.barriers.length - 1; i >= 0; i--) {
    if (MATCH.barriers[i].arena) continue; // arena walls are permanent
    MATCH.barriers[i].life -= dt;
    if (MATCH.barriers[i].life <= 0) MATCH.barriers.splice(i, 1);
  }
  for (let i = MATCH.magnetPoints.length - 1; i >= 0; i--) {
    MATCH.magnetPoints[i].life -= dt;
    if (MATCH.magnetPoints[i].life <= 0) MATCH.magnetPoints.splice(i, 1);
  }
  for (let i = MATCH.pulses.length - 1; i >= 0; i--) {
    MATCH.pulses[i].life -= dt;
    if (MATCH.pulses[i].life <= 0) MATCH.pulses.splice(i, 1);
  }
  for (let i = MATCH.clones.length - 1; i >= 0; i--) {
    const c = MATCH.clones[i];
    c.life -= dt;
    if (!frozenPhysics) {
      const b = MATCH.ball;
      if (b) {
        const n = norm(b.pos.x - c.x, b.pos.y - c.y);
        c.x += n.x * 190 * dt;
        c.y += n.y * 190 * dt;
        c.x = clamp(c.x, FIELD.x + 30, FIELD.x + FIELD.w - 30);
        c.y = clamp(c.y, FIELD.y + 30, FIELD.y + FIELD.h - 30);
        c.bob += dt * 4;
      }
    }
    if (c.life <= 0) MATCH.clones.splice(i, 1);
  }
  // Clone Shot decoys: they only travel and fade — nothing can score off them
  for (let i = MATCH.ballFakes.length - 1; i >= 0; i--) {
    const f = MATCH.ballFakes[i];
    f.life -= dt;
    if (!frozenPhysics) {
      const decay = Math.pow(0.62, dt);
      f.vx *= decay; f.vy *= decay;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.rot += Math.hypot(f.vx, f.vy) * dt / f.radius;
      if (f.x < FIELD.x + f.radius && f.vx < 0) f.vx = Math.abs(f.vx) * 0.7;
      if (f.x > FIELD.x + FIELD.w - f.radius && f.vx > 0) f.vx = -Math.abs(f.vx) * 0.7;
      if (f.y < FIELD.y + f.radius && f.vy < 0) f.vy = Math.abs(f.vy) * 0.7;
      if (f.y > FIELD.y + FIELD.h - f.radius && f.vy > 0) f.vy = -Math.abs(f.vy) * 0.7;
    }
    if (f.life <= 0) MATCH.ballFakes.splice(i, 1);
  }
  if (MATCH.miniGoal) {
    const mg = MATCH.miniGoal;
    mg.life -= dt;
    mg.pulse += dt;
    if (mg.life <= 0) MATCH.miniGoal = null;
  }
  const b = MATCH.ball;
  if (b) {
    if (b.rocket > 0 && !frozenPhysics && SAVE.settings.visualFx) {
      if (Math.random() < dt * 60) {
        MATCH.particles.push({ x: b.pos.x, y: b.pos.y, vx: rand(-60, 60), vy: rand(-60, 60),
          life: 0.4, maxLife: 0.4, size: rand(3, 7), color: pick(["#ffb43c", "#ff6a2b", "#fff2b0"]), drag: 0.93 });
      }
    }
  }
}

/* ---------- HUD ---------- */
function buildMatchHud() {
  $("hud-mode").textContent = MATCH.tutorial
    ? "Tutorial · Coach Rex"
    : modeLabel(MATCH.mode) + (AI_MODES.has(MATCH.mode) ? " · " + DIFFICULTY[MATCH.difficulty].label : "");
  $("hud-name-a").textContent = teamName(0);
  $("hud-name-b").textContent = teamName(1);
  $("hud-target").textContent = MATCH.tutorial
    ? "Guided practice"
    : (MATCH.target > 0 ? "First to " + MATCH.target : "Timed match");
  MATCH.hud = [];
  const clusters = [$("hud-p1"), $("hud-p2")];
  clusters.forEach(c => { c.innerHTML = ""; });
  const humans = MATCH.players.filter(p => p.human);
  humans.forEach((p, i) => {
    const cluster = clusters[i];
    if (!cluster) return;
    cluster.style.display = "flex";
    const refs = [];
    for (let slot = 0; slot < 3; slot++) {
      const card = document.createElement("div");
      card.className = "abil-hud" + (slot === 2 ? " sig" : "");
      card.innerHTML = `<div class="top"><div class="abil-ico">✨</div><div class="nm">Empty</div><div class="slot-key"></div></div>
        <div class="cd-track"><i class="cd-fill"></i></div>
        <div class="cd-num"></div>
        <div class="swap-hint"></div>`;
      cluster.appendChild(card);
      refs.push({ el: card, ico: card.querySelector(".abil-ico"), nm: card.querySelector(".nm"),
        key: card.querySelector(".slot-key"), fill: card.querySelector(".cd-fill"),
        num: card.querySelector(".cd-num"), hint: card.querySelector(".swap-hint") });
    }
    MATCH.hud.push({ player: p, refs });
  });
  clusters.forEach((c, i) => { if (i >= humans.length) c.style.display = "none"; });
  // control legend
  const legend = $("control-legend");
  legend.innerHTML = humans.map(p => {
    const keys = SAVE.keys[p.control === "p2" ? "p2" : "p1"];
    return `<span><b>${escapeHtml(p.label || "P1")}</b> <kbd>${keyLabel(keys.up)}${keyLabel(keys.left)}${keyLabel(keys.down)}${keyLabel(keys.right)}</kbd> move · <kbd>${keyLabel(keys.kick)}</kbd> kick · <kbd>${keyLabel(keys.ability1)}</kbd> / <kbd>${keyLabel(keys.ability2)}</kbd> abilities · <kbd>${keyLabel(keys.signature)}</kbd> signature</span>`;
  }).join("") + `<span><b>Esc</b> pause</span>`;
  updateAbilityHud();
}
function updateAbilityHud() {
  for (const entry of MATCH.hud) {
    const p = entry.player;
    const keys = SAVE.keys[p.control === "p2" ? "p2" : "p1"];
    entry.refs.forEach((ref, slot) => {
      const isSig = slot === 2;
      const sig = p.sig;
      const id = isSig ? (sig ? sig.id : "") : p.abilities[slot];
      const ab = isSig
        ? (sig ? { id: sig.id, icon: sig.icon, name: sig.name, cd: sig.cd } : null)
        : (id ? ABIL_BY_ID[id] : null);
      const cd = ab ? (p.cooldowns[ab.id] || 0) : 0;
      const active = !isSig && p.activeSlot === slot && !!ab;
      ref.el.classList.toggle("active", !!active);
      ref.el.classList.toggle("cooling", cd > 0);
      ref.el.classList.toggle("ready", !!ab && cd <= 0);
      ref.el.classList.toggle("locked", !ab);
      ref.el.classList.toggle("sig", isSig);
      const slotKey = isSig ? keys.signature : (slot === 0 ? keys.ability1 : keys.ability2);
      if (ab) {
        ref.ico.textContent = ab.icon;
        ref.nm.textContent = ab.name;
        ref.key.textContent = keyLabel(slotKey);
        const pct = cd > 0 ? (1 - cd / ab.cd) * 100 : 100;
        ref.fill.style.width = clamp(pct, 0, 100) + "%";
        ref.num.textContent = cd > 0 ? Math.ceil(cd) + "s" : "";
        ref.hint.textContent = isSig
          ? "Signature · " + keyLabel(slotKey)
          : (slot === 0 ? "Slot 1" : "Slot 2") + (active ? " · active" : "") + " · " + keyLabel(slotKey) + " uses it";
      } else {
        ref.ico.textContent = isSig ? "🎽" : "➕";
        ref.nm.textContent = isSig ? "No signature" : "Empty slot";
        ref.key.textContent = keyLabel(slotKey);
        ref.fill.style.width = "0%";
        ref.num.textContent = "";
        ref.hint.textContent = isSig ? "Pick a character in Collection" : (slot === 0 ? "Slot 1 · equip in Play" : "Slot 2 · equip in Play");
      }
    });
  }
}
function updateMatchHud() {
  const scoreEl = $("hud-score");
  if (scoreEl) scoreEl.innerHTML = MATCH.score[0] + " <em>–</em> " + MATCH.score[1];
  const timerEl = $("hud-timer");
  if (timerEl) timerEl.textContent = MATCH.tutorial ? "∞" : fmtTime(MATCH.timeLeft);
  const now = performance.now();
  if (now - MATCH.hudAt > 100) {
    MATCH.hudAt = now;
    updateAbilityHud();
  }
  // Ability Rush counts down to the next hand of random abilities
  if (RUSH_MODES.has(MATCH.mode) && MATCH.active) {
    const modeEl = $("hud-mode");
    if (modeEl) modeEl.textContent = modeLabel(MATCH.mode) +
      (AI_MODES.has(MATCH.mode) ? " · " + (DIFFICULTY[MATCH.difficulty] || DIFFICULTY.beginner).label : "") +
      " · new abilities in " + Math.max(0, Math.ceil(MATCH.rushTimer)) + "s";
  }
}

/* ---------- pause ---------- */
function togglePause(force) {
  if (!MATCH.active || MATCH.over) return;
  const target = typeof force === "boolean" ? force : !MATCH.paused;
  if (target === MATCH.paused) return;
  MATCH.paused = target;
  if (target) CG.gameplayStop(); else CG.gameplayStart();
  if (target) Sound.stopCrowd(); else Sound.startCrowd();
  $("pause-menu").classList.toggle("show", target);
  $("pause-score").textContent = MATCH.score[0] + " – " + MATCH.score[1];
  if (target) {
    $("pause-controls").innerHTML = (MATCH.humans || []).map(p => {
      const k = SAVE.keys[p.control === "p2" ? "p2" : "p1"];
      return `<div><b>${escapeHtml(p.label || "P1")}</b> · Move <kbd>${keyLabel(k.up)} ${keyLabel(k.left)} ${keyLabel(k.down)} ${keyLabel(k.right)}</kbd><br>Kick <kbd>${keyLabel(k.kick)}</kbd> · Ability 1 <kbd>${keyLabel(k.ability1)}</kbd> · Ability 2 <kbd>${keyLabel(k.ability2)}</kbd> · Signature <kbd>${keyLabel(k.signature)}</kbd></div>`;
    }).join("") + `<div><b>Esc</b> resumes · <b>P</b> also pauses</div>`;
    Sound.play("click");
  }
  input = Object.create(null);
}

/* ---------- result ---------- */
/* Fair reward table, calculated once at the end of a completed match.
   Win and loss are mutually exclusive; each goal/shot/save is counted once
   when it happens, and Double Coins multiplies the finished total only once. */
const REWARD_TABLE = { win:25, loss:10, draw:10, goal:50, shotOnTarget:15, save:10, completion:10 };
const AI_MODES = new Set(["1v1ai", "bounce", "rush", "2v2ai", "2v2coop"]);
/* Local couch matches have no AI opponent, so they simply pay the baseline. */
function difficultyReward() {
  if (!AI_MODES.has(MATCH.mode)) return { mult: 1, label: "Local match", ai: false };
  const d = DIFFICULTY[MATCH.difficulty] || DIFFICULTY.beginner;
  return { mult: d.reward || 1, label: d.label, ai: true };
}
function computeRewards() {
  const [a, b] = MATCH.score;
  const outcome = a > b ? "win" : a < b ? "loss" : "draw";
  const resultCoins = REWARD_TABLE[outcome];
  const goals = MATCH.rewardEvents.goals;
  const shots = MATCH.rewardEvents.shotsOnTarget;
  const saves = MATCH.rewardEvents.saves;
  const completion = REWARD_TABLE.completion;
  const base = resultCoins + goals * REWARD_TABLE.goal + shots * REWARD_TABLE.shotOnTarget +
    saves * REWARD_TABLE.save + completion;
  // Difficulty pays out once, on the earned subtotal, before any multiplier.
  const diff = difficultyReward();
  const difficultyCoins = Math.round(base * (diff.mult - 1));
  const subtotal = base + difficultyCoins;
  const double = SAVE.doubleCoins.matchesLeft > 0;
  const total = double ? subtotal * 2 : subtotal;
  return { outcome, resultCoins, goals, goalCoins: goals * REWARD_TABLE.goal,
    shots, shotCoins: shots * REWARD_TABLE.shotOnTarget, saves, saveCoins: saves * REWARD_TABLE.save,
    completion, base, diff, difficultyCoins, subtotal, double, total, bonus: MATCH.bonusCoins };
}
function endMatch(reason) {
  if (MATCH.over) return;
  // A tutorial never reaches the payout screen — it pays nothing, so it can
  // never be farmed. Walking out of it just returns to the Play menu.
  if (MATCH.tutorial) { finishTutorial(); return; }
  releaseBall(MATCH.ball);
  MATCH.state = "over";
  MATCH.over = true;
  MATCH.paused = false;
  CG.gameplayStop();
  hideCountdown();
  hideGoalBanner();
  $("pause-menu").classList.remove("show");
  const rewards = computeRewards();
  resultAdState = { total: rewards.total, doubled: false };
  SAVE.coins += rewards.total;
  SAVE.stats.matches++;
  SAVE.stats.goals += MATCH.score[0];
  SAVE.stats.coinsEarned += rewards.total;
  if (rewards.outcome === "win") SAVE.stats.wins++;
  else if (rewards.outcome === "loss") SAVE.stats.losses++;
  else SAVE.stats.draws++;
  if (rewards.double) SAVE.doubleCoins.matchesLeft = Math.max(0, SAVE.doubleCoins.matchesLeft - 1);
  persist();
  refreshCoins();

  const humanWon = rewards.outcome === "win";
  // Two humans on opposite sides (local PvP): the coins still follow team 0, so every
  // row names the side it belongs to and the headline states who actually won.
  const versus = versusResult();
  $("result-badge").textContent = reason === "target" ? "Target reached" : reason === "firstgoal" ? "First goal won it" : "Full time";
  $("result-title").textContent = versus
    ? (versus.winner ? versus.winnerLabel + " wins" : "Draw")
    : rewards.outcome === "win" ? "Victory!" : rewards.outcome === "loss" ? "Defeat" : "Draw";
  $("result-sub").textContent = versus
    ? versus.homeLabel + " " + MATCH.score[0] + " – " + MATCH.score[1] + " " + versus.awayLabel
    : rewards.outcome === "win"
      ? "The pitch is yours. Every coin below is itemised."
      : rewards.outcome === "loss" ? "Shake it off — rematch and get them back." : "Honours even. One more match?";
  $("result-score").textContent = MATCH.score[0] + " – " + MATCH.score[1];
  const resultLabel = versus
    ? versus.homeLabel + (rewards.outcome === "win" ? " win bonus" : rewards.outcome === "loss" ? " loss bonus" : " draw bonus")
    : rewards.outcome === "win" ? "Win bonus" : rewards.outcome === "loss" ? "Loss bonus" : "Draw bonus";
  const statLabel = versus
    ? { goals: versus.homeLabel + " goals", shots: versus.homeLabel + " shots on target", saves: versus.homeLabel + " saves" }
    : { goals: "Your goals", shots: "Your shots on target", saves: "Your saves" };
  $("result-rewards").innerHTML = `
    <div class="reward-row"><span>${resultLabel}</span><b>+${rewards.resultCoins}</b></div>
    <div class="reward-row"><span>${statLabel.goals} <span class="rr-note">${rewards.goals} × 50</span></span><b>+${rewards.goalCoins}</b></div>
    <div class="reward-row"><span>${statLabel.shots} <span class="rr-note">${rewards.shots} × 15</span></span><b>+${rewards.shotCoins}</b></div>
    <div class="reward-row"><span>${statLabel.saves} <span class="rr-note">${rewards.saves} × 10</span></span><b>+${rewards.saveCoins}</b></div>
    <div class="reward-row"><span>Match completed</span><b>+${rewards.completion}</b></div>
    <div class="reward-row"><span>Difficulty <span class="rr-note">${rewards.diff.label}${rewards.diff.ai ? " ×" + rewards.diff.mult : ""}</span></span>${rewards.difficultyCoins > 0 ? `<b>+${rewards.difficultyCoins}</b>` : `<b>baseline</b>`}</div>
    ${rewards.difficultyCoins > 0 ? `<div class="reward-row"><span>Subtotal</span><b>${rewards.subtotal}</b></div>` : ""}
    ${rewards.double ? `<div class="reward-row"><span>Double Coins active <span class="rr-note">applied once to the total</span></span><b>×2</b></div>` : ""}
    <div class="reward-row reward-total"><span>Coins added</span><b>+${rewards.total}</b></div>
    ${rewards.bonus > 0 ? `<div class="reward-row"><span>Mini Goal bonus <span class="rr-note">already paid on the pitch</span></span><b>+${rewards.bonus}</b></div>` : ""}
    <div class="reward-row"><span>Abilities used</span><b>${MATCH.abilityUses}</b></div>`;
  $("result").classList.add("show");
  Sound.stopCrowd();
  Sound.play(humanWon ? "win" : "lose");
  updateAdButton();
}

/* A local match with humans on both sides reads from both players' point of view:
   the payout follows team 0, so the rows name that side instead of saying "Your".
   Returns null whenever there is only one side with humans (every mode vs AI), which
   keeps those results screens exactly as they were. */
function versusResult() {
  const humans = MATCH.humans || [];
  const home = humans.filter(p => p.team === 0);
  const away = humans.filter(p => p.team !== 0);
  if (!home.length || !away.length) return null;
  const a = MATCH.score[0], b = MATCH.score[1];
  const label = list => list.map(p => p.label || (p.team === 0 ? "P1" : "P2")).join(" + ");
  return {
    homeLabel: label(home), awayLabel: label(away),
    winner: a > b ? home : b > a ? away : null,
    get winnerLabel() { return this.winner === home ? this.homeLabel : this.awayLabel; },
  };
}

/* ==========================================================================
   TUTORIAL — Coach Rex walks a new player through the real match engine
   This is a genuine 1v1 match, not a mock: the same physics, kick, abilities,
   HUD and goal rules. The opponent is parked, the clock is frozen and no coins
   are paid, so nothing here can be farmed while every lesson stays honest.
   Each step watches real match state — none of them advance on a timer.
   ========================================================================== */
const COACH_CHAR = CHAR_BY_ID.rex || CHARACTERS[0];
const COACH_LOOK = { color:"#48e08a", colorId:"lime", hat:"cap", hatColor:"#0f1a33",
  trail:"sparkle", glow:"neon", ballColor:"#f4f8ff" };
const TUTORIAL = {
  active: false, step: 0, moved: 0, lastPos: null,
  shots0: 0, score0: 0, uses: {}, cools: {}, steps: [], portraitClock: 0,
};
function tutorialP1() {
  return (MATCH.humans && MATCH.humans[0]) || null;
}
/* Built per run so every key hint shows the player's actual bindings. */
function tutorialSteps() {
  const k = (SAVE.keys && SAVE.keys.p1) || DEFAULT_KEYS.p1;
  const kb = code => `<kbd>${keyLabel(code)}</kbd>`;
  const p = tutorialP1();
  const sig = (p && p.sig) || SIGNATURES.pip;
  const power = ABIL_BY_ID.power, dash = ABIL_BY_ID.dash;
  return [
    { label: "Move",
      text: `Evening, striker — I'm <b>Coach Rex</b>. This is the real game, just without the pressure. First up: hold ${kb(k.up)} ${kb(k.left)} ${kb(k.down)} ${kb(k.right)} to run around the pitch.`,
      done: () => TUTORIAL.moved >= 90 },
    { label: "Kick",
      text: `Good feet. Get close to the ball and press ${kb(k.kick)} to kick — you always kick the way you last moved, so line your run up first.`,
      done: () => MATCH.shots > TUTORIAL.shots0 },
    { label: "Score",
      text: `Now the whole point: put it in the far net. Walk onto the ball and kick toward the goal on the right.`,
      done: () => MATCH.score[0] > TUTORIAL.score0 },
    { label: "Ability slot 1",
      text: `Here's the fun part. You carry <b>two special abilities</b>, one per slot. Slot 1 is <b>${power.icon} ${power.name}</b> on ${kb(k.ability1)} — press it, then kick: the shot comes out far faster.`,
      done: () => (TUTORIAL.uses.power || 0) >= 1 },
    { label: "Ability slot 2",
      text: `Slot 2 is <b>${dash.icon} ${dash.name}</b> on ${kb(k.ability2)} — a burst of pace for winning a loose ball. Give it a go.`,
      done: () => (TUTORIAL.uses.dash || 0) >= 1 },
    { label: "Cooldowns",
      text: `Powerful things need recharging — each ability shows its timer on the card below. That timer <b>keeps ticking through a goal</b>: scoring never hands you a free reset, so one shot can't be spammed all match. Press ${kb(k.ability1)} again once Power Shot is ready.`,
      done: () => (TUTORIAL.uses.power || 0) >= 2 },
    { label: "Signature",
      text: `Last one, and it's yours forever: a <b>signature</b> on ${kb(k.signature)} — <b>${sig.icon} ${sig.name}</b>. Signatures come from your character, not from packs, and never leave your HUD.`,
      done: () => (TUTORIAL.uses[sig.id] || 0) >= 1 },
    { label: "Ready",
      text: `That's the game: move, kick, two ability slots, one signature — and cooldowns that never reset on a goal. Equip loadouts in <b>Play</b>, earn more abilities from packs, and hit <b>Esc</b> any time to pause. Go light up the pitch.`,
      done: null },
  ];
}
function startTutorial() {
  Sound.play("click");
  TUTORIAL.active = true;
  TUTORIAL.step = 0;
  TUTORIAL.moved = 0;
  TUTORIAL.lastPos = null;
  TUTORIAL.uses = {};
  TUTORIAL.cools = {};
  startMatch({ mode:"1v1ai", duration:300, target:0, difficulty:"beginner", firstGoal:false, tutorial:true });
  TUTORIAL.steps = tutorialSteps();
  TUTORIAL.shots0 = MATCH.shots;
  TUTORIAL.score0 = MATCH.score[0];
  const p = tutorialP1();
  if (p) for (const id of Object.keys(p.cooldowns || {})) TUTORIAL.cools[id] = p.cooldowns[id] || 0;
  const bar = $("tutorial-bar");
  if (bar) bar.classList.add("show");
  renderTutorial();
  resizeCanvas();
  requestAnimationFrame(resizeCanvas);
}
function renderTutorial() {
  if (!TUTORIAL.active) return;
  const step = TUTORIAL.steps[TUTORIAL.step];
  if (!step) return;
  $("tutorial-step").textContent = `Step ${TUTORIAL.step + 1} of ${TUTORIAL.steps.length} · ${step.label}`;
  $("tutorial-text").innerHTML = step.text;
  $("tutorial-dots").innerHTML = TUTORIAL.steps.map((s, i) =>
    `<i class="${i < TUTORIAL.step ? "done" : i === TUTORIAL.step ? "on" : ""}"></i>`).join("");
  $("btn-tutorial-skip").textContent = step.done ? "Skip step" : "Finish";
}
function advanceTutorial() {
  if (!TUTORIAL.active || MATCH.paused) return;
  TUTORIAL.step++;
  const p = tutorialP1();
  if (p) for (const id of Object.keys(p.cooldowns || {})) TUTORIAL.cools[id] = p.cooldowns[id] || 0;
  TUTORIAL.shots0 = MATCH.shots;
  TUTORIAL.score0 = MATCH.score[0];
  if (TUTORIAL.step >= TUTORIAL.steps.length) { finishTutorial(); return; }
  Sound.play("click");
  renderTutorial();
}
function endTutorial(message) {
  TUTORIAL.active = false;
  TUTORIAL.steps = [];
  TUTORIAL.lastPos = null;
  const bar = $("tutorial-bar");
  if (bar) bar.classList.remove("show");
  MATCH.tutorial = false;
  if (MATCH.active) exitMatch();
  showScreen("play", { force: true });
  resizeCanvas();
  if (message) toast(message, "good");
}
function finishTutorial() {
  endTutorial("Tutorial complete — you know the pitch now.");
}
function drawTutorialPortrait() {
  drawAvatarPreview($("tutorial-portrait"), COACH_CHAR, COACH_LOOK, 1.05);
}
function tutorialTick(dt) {
  if (!TUTORIAL.active || !MATCH.active || !MATCH.tutorial) return;
  const p = tutorialP1();
  if (!p) return;
  if (TUTORIAL.lastPos && MATCH.state === "playing") {
    TUTORIAL.moved += Math.hypot(p.pos.x - TUTORIAL.lastPos.x, p.pos.y - TUTORIAL.lastPos.y);
  }
  TUTORIAL.lastPos = { x: p.pos.x, y: p.pos.y };
  // Ability uses are counted from real cooldown edges, so a denied press during
  // a cooldown never counts as a use.
  for (const id of Object.keys(p.cooldowns || {})) {
    const now = p.cooldowns[id] || 0;
    const prev = TUTORIAL.cools[id] || 0;
    if (now > 0 && prev <= 0) TUTORIAL.uses[id] = (TUTORIAL.uses[id] || 0) + 1;
    TUTORIAL.cools[id] = now;
  }
  TUTORIAL.portraitClock += dt;
  if (TUTORIAL.portraitClock > 0.06) { TUTORIAL.portraitClock = 0; drawTutorialPortrait(); }
  if (MATCH.paused || MATCH.over) return;
  const step = TUTORIAL.steps[TUTORIAL.step];
  if (step && step.done && step.done()) advanceTutorial();
}

/* ---------- input ---------- */
const BLOCKED_CODES = new Set(["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"]);
function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
function handleMatchKeyDown(code, e) {
  if (!MATCH.active || MATCH.over || MATCH.paused) return;
  for (const p of MATCH.humans) {
    const keys = SAVE.keys[p.control === "p2" ? "p2" : "p1"];
    if (code === keys.kick) { playerKick(p); e.preventDefault(); return; }
    if (code === keys.ability1) { useAbilitySlot(p, 0); e.preventDefault(); return; }
    if (code === keys.ability2) { useAbilitySlot(p, 1); e.preventDefault(); return; }
    if (code === keys.signature) { useSignature(p); e.preventDefault(); return; }
  }
  if (BLOCKED_CODES.has(code)) e.preventDefault();
}
window.addEventListener("keydown", (e) => {
  Sound.resume();
  if (tryBindKey(e.code)) { e.preventDefault(); return; }
  if (isTypingTarget(e.target)) return;
  // A focused menu button must never swallow a gameplay key (Enter used to
  // re-click Pause/Rematch and looked like a random reset).
  if (MATCH.active && document.activeElement && document.activeElement.tagName === "BUTTON") {
    document.activeElement.blur();
  }
  if (MATCH.active) {
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!e.repeat) togglePause();
      e.preventDefault();
      return;
    }
    handleMatchKeyDown(e.code, e);
    input[e.code] = true;
    return;
  }
  if (e.code === "Escape") {
    const openOverlay = document.querySelector(".overlay.show");
    if (!openOverlay) return;
    if (openOverlay.id === "pack-overlay") { closePackOverlay(); return; }
    if (openOverlay.id === "confirm-modal") { confirmCallback = null; }
    openOverlay.classList.remove("show");
  }
});
window.addEventListener("keyup", (e) => { input[e.code] = false; });
window.addEventListener("blur", () => {
  input = Object.create(null);
  if (MATCH.active && !MATCH.over && !MATCH.paused) togglePause(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && MATCH.active && !MATCH.over && !MATCH.paused) togglePause(true);
});
// Accidental refresh/close during a live match asks first instead of silently losing it.
window.addEventListener("beforeunload", (e) => {
  if (MATCH.active && !MATCH.over) { e.preventDefault(); e.returnValue = ""; }
});
window.addEventListener("pointerdown", () => { Sound.resume(); Sound.startMusic(); });

/* ---------- canvas ---------- */
function resizeCanvas() {
  const stage = $("stage");
  const canvas = $("game-canvas");
  if (!stage || !canvas) return;
  const sw = stage.clientWidth - 16;
  const sh = stage.clientHeight - 16;
  if (sw <= 0 || sh <= 0) return;
  const scale = Math.min(sw / WORLD.w, sh / WORLD.h);
  const cssW = WORLD.w * scale, cssH = WORLD.h * scale;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvasScale = scale;
}
window.addEventListener("resize", () => { if (MATCH.active) resizeCanvas(); });
/* The pitch also changes size when in-page chrome appears or disappears — the coach
   bar, the compact breakpoints, a wrapped line — none of which fire a window resize.
   Watching the stage itself keeps the canvas exactly fitted instead of stale. */
if (typeof ResizeObserver === "function") {
  const stageEl = $("stage");
  if (stageEl) {
    let lastW = 0, lastH = 0;
    new ResizeObserver(() => {
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      if (MATCH.active) resizeCanvas();
    }).observe(stageEl);
  }
}

/* ---------- main loop ---------- */
let lastFrameTime = 0;
let playtimeTick = 0;
/* Only genuine active match play counts: not paused, not finished, tab visible,
   no modal covering the pitch. Menus and background tabs never tick it up. */
function accruePlaytime(dt) {
  if (!MATCH.active || MATCH.paused || MATCH.over || MATCH.state === "idle") return false;
  if (MATCH.tutorial) return false; // practice time never feeds playtime rewards
  if (document.visibilityState !== "visible") return false;
  if (document.querySelector(".overlay.show")) return false;
  SAVE.playtime.seconds += dt;
  playtimeTick += dt;
  if (playtimeTick > 5) { playtimeTick = 0; persist(); }
  return true;
}
function gameLoop(now) {
  if (!lastFrameTime) lastFrameTime = now;
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  if (MATCH.active) {
    if (!MATCH.paused && !MATCH.over) { stepMatch(dt); tutorialTick(dt); }
    renderMatch(dt);
    accruePlaytime(dt);
  }
  requestAnimationFrame(gameLoop);
}

/* ==========================================================================
   AI — positioning, passing, shooting, defending, abilities
   ========================================================================== */
function ownGoalCenter(team) {
  return { x: team === 0 ? FIELD.x : FIELD.x + FIELD.w, y: CY };
}
function oppGoalCenter(team) {
  return { x: team === 0 ? FIELD.x + FIELD.w : FIELD.x, y: CY };
}
function updateAI(p, dt) {
  // Tutorial: the opponent stays parked so every lesson happens without pressure.
  if (MATCH.tutorial) { p.aiDir.x = 0; p.aiDir.y = 0; p.aiIntent = "rest"; return; }
  p.aiAbilityClock -= dt;
  const diff = DIFFICULTY[MATCH.difficulty] || DIFFICULTY.normal;
  p.aiTimer -= dt;
  if (p.aiTimer <= 0 || !p.aiTarget) {
    p.aiTimer = diff.react * rand(0.75, 1.3);
    decideAIPlan(p, diff);
  }
  if (p.aiIntent === "rest") {
    p.aiDir.x = 0; p.aiDir.y = 0;
    return;
  }
  const b = MATCH.ball;
  let target = p.aiTarget || { x: b.pos.x, y: b.pos.y };
  // small jitter so the AI does not look robotic
  const wobble = Math.sin(p.bob * 0.9) * 8;
  target = { x: target.x + wobble, y: target.y };
  const d = dist(p.pos.x, p.pos.y, target.x, target.y);
  if (d > 8) {
    const n = norm(target.x - p.pos.x, target.y - p.pos.y);
    p.aiDir.x = n.x; p.aiDir.y = n.y;
    p.facing = { x: n.x, y: n.y };
  } else {
    p.aiDir.x = 0; p.aiDir.y = 0;
  }
  // never let the AI sit inside its own net
  if (p.pos.x < FIELD.x + 120 && p.pos.y > GOAL_MOUTH.min && p.pos.y < GOAL_MOUTH.max) {
    p.aiDir.x = Math.abs(p.aiDir.x) + 0.35;
  }
}
function decideAIPlan(p, diff) {
  const b = MATCH.ball;
  if (!b) return;
  const oppGoal = oppGoalCenter(p.team);
  const ownGoal = ownGoalCenter(p.team);
  const mates = MATCH.players.filter(q => q.team === p.team && q.id !== p.id);
  const ballPred = { x: b.pos.x + b.vel.x * 0.16, y: b.pos.y + b.vel.y * 0.16 };
  const myDist = dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y);
  const distances = mates.map(q => dist(q.pos.x, q.pos.y, b.pos.x, b.pos.y));
  const closest = mates.length === 0 || distances.every(d => myDist <= d + 12);
  const mateWithBall = mates.find(q => dist(q.pos.x, q.pos.y, b.pos.x, b.pos.y) < 74);
  const ballNearOwnGoal = dist(b.pos.x, b.pos.y, ownGoal.x, ownGoal.y) < 340;
  const cloneConfuse = MATCH.clones.find(c => c.team !== p.team);

  // Beginner AI often just watches the play instead of chasing, but it still
  // reacts when the ball is right next to it or rolling toward its own net.
  const urgent = myDist < 110 || dist(b.pos.x, b.pos.y, ownGoal.x, ownGoal.y) < 300;
  if (diff.idle > 0 && !urgent && Math.random() < diff.idle) {
    p.aiIntent = "rest";
    p.aiTarget = { x: p.pos.x, y: p.pos.y };
    p.aiDir.x = 0; p.aiDir.y = 0;
    return;
  }

  if (cloneConfuse && Math.random() < 0.32) {
    p.aiTarget = { x: cloneConfuse.x, y: cloneConfuse.y };
    return;
  }

  if (!closest && mateWithBall) {
    // support the ball carrier instead of piling onto the ball
    const advance = p.team === 0 ? 1 : -1;
    const supportX = clamp(b.pos.x + advance * 260, FIELD.x + 120, FIELD.x + FIELD.w - 120);
    const spread = (p.id % 2 === 0 ? -1 : 1) * (150 + Math.sin(p.bob) * 30);
    p.aiTarget = { x: supportX, y: clamp(b.pos.y + spread, FIELD.y + 70, FIELD.y + FIELD.h - 70) };
    p.aiIntent = "support";
    maybeAIAbility(p, "support");
    return;
  }

  if (closest) {
    p.aiIntent = "chase";
    // approach the ball from the side facing the enemy goal so kicks go forward
    const attackDir = norm(oppGoal.x - b.pos.x, oppGoal.y - b.pos.y);
    const behind = { x: b.pos.x - attackDir.x * 26, y: b.pos.y - attackDir.y * 26 };
    if (ballNearOwnGoal && dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) > 70 && Math.random() < 0.5) {
      // hold a goal-side position before tackling
      const g = norm(ownGoal.x - b.pos.x, ownGoal.y - b.pos.y);
      p.aiTarget = { x: b.pos.x + g.x * 40, y: b.pos.y + g.y * 40 };
    } else {
      p.aiTarget = behind;
    }
    if (dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) < p.radius + b.radius + 40) {
      aiBallAction(p, b, oppGoal, ownGoal, mates, diff, ballPred);
    }
    maybeAIAbility(p, "attack");
    return;
  }

  // cover: block the lane between the ball and our goal
  const coverX = p.team === 0
    ? clamp(b.pos.x - 250, FIELD.x + 140, FIELD.x + FIELD.w - 160)
    : clamp(b.pos.x + 250, FIELD.x + 160, FIELD.x + FIELD.w - 140);
  p.aiTarget = { x: coverX, y: clamp(lerp(b.pos.y, ownGoal.y, 0.3), FIELD.y + 80, FIELD.y + FIELD.h - 80) };
  p.aiIntent = "cover";
  maybeAIAbility(p, ballNearOwnGoal ? "defend" : "support");
}
function aiBallAction(p, b, oppGoal, ownGoal, mates, diff, ballPred) {
  const pressure = MATCH.players.filter(q => q.team !== p.team && dist(q.pos.x, q.pos.y, p.pos.x, p.pos.y) < 92).length;
  const distGoal = dist(b.pos.x, b.pos.y, oppGoal.x, oppGoal.y);
  const nearOwnGoal = dist(b.pos.x, b.pos.y, ownGoal.x, ownGoal.y) < 260;
  const mate = mates.find(q => dist(q.pos.x, q.pos.y, p.pos.x, p.pos.y) > 100);
  const attackDir = p.team === 0 ? 1 : -1;

  if (nearOwnGoal && pressure > 0) {
    // clearance upfield, away from our own net
    const aim = { x: attackDir, y: rand(-0.55, 0.55) };
    const n = norm(aim.x, aim.y);
    p.facing = n;
    playerKick(p);
    return;
  }

  // pass when a teammate is better placed or we are under pressure
  if (mate && distGoal > 260) {
    const mateAhead = p.team === 0 ? mate.pos.x > p.pos.x + 80 : mate.pos.x < p.pos.x - 80;
    const passChance = (pressure > 0 ? 0.55 : 0.28) + (mateAhead ? 0.2 : 0);
    if (Math.random() < passChance * diff.ability) {
      const lead = { x: mate.pos.x + mate.vel.x * 0.18, y: mate.pos.y + mate.vel.y * 0.18 };
      const n = norm(lead.x - p.pos.x, lead.y - p.pos.y);
      p.facing = n;
      playerKick(p);
      addText(p.pos.x, p.pos.y - 34, "PASS", "#8fe8ff");
      return;
    }
  }

  // shoot when a sensible sight of goal exists
  const angleOk = Math.abs(b.pos.y - oppGoal.y) < 260;
  if (distGoal < 720 && angleOk) {
    const err = diff.aim * 200;
    const ty = clamp(CY + rand(-62, 62) + rand(-err, err), GOAL_MOUTH.min + 34, GOAL_MOUTH.max - 34);
    const n = norm(oppGoal.x - b.pos.x, ty - b.pos.y);
    p.facing = n;
    playerKick(p);
    return;
  }
  // otherwise dribble toward goal
  const n = norm(oppGoal.x - b.pos.x, oppGoal.y - b.pos.y);
  p.aiTarget = { x: b.pos.x + n.x * 30, y: b.pos.y + n.y * 30 };
  p.facing = n;
}
function maybeAIAbility(p, intent) {
  if (p.aiAbilityClock > 0) return;
  const diff = DIFFICULTY[MATCH.difficulty] || DIFFICULTY.normal;
  const b = MATCH.ball;
  const ready = p.abilities.filter(id => id && (p.cooldowns[id] || 0) <= 0);
  if (!ready.length) { p.aiAbilityClock = 1.6; return; }
  const distBall = dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y);
  const nearOwnGoal = dist(b.pos.x, b.pos.y, ownGoalCenter(p.team).x, ownGoalCenter(p.team).y) < 360;
  const nearOppGoal = dist(b.pos.x, b.pos.y, oppGoalCenter(p.team).x, oppGoalCenter(p.team).y) < 620;
  const shootSet = ["power","curve","flame","double","lightning","rocket","fake",
    "thunder","boomerang","ricochet","cloneshot","portal","phoenix","quake","sonic"];
  const defendSet = ["shield","goalwall","freeze","superblock","keeper","shockwave","pulse","timeslow",
    "shieldball","magneticsteal","tornado"];
  const moveSet = ["teleport","dash","blink","sprint","magnetboots","ballmagnet","gravity","recall","sticky",
    "gravityball","phantom"];
  let choice = null;
  if (intent === "attack" && nearOppGoal && distBall < 110 && Math.random() < diff.ability * 0.8) {
    choice = ready.find(id => shootSet.includes(id));
  }
  if (!choice && (intent === "defend" || nearOwnGoal) && Math.random() < diff.ability * 0.8) {
    choice = ready.find(id => defendSet.includes(id));
  }
  if (!choice && intent === "attack" && distBall > 150 && Math.random() < diff.ability * 0.5) {
    choice = ready.find(id => moveSet.includes(id));
  }
  if (!choice && intent !== "attack" && Math.random() < diff.ability * 0.35) {
    choice = ready.find(id => moveSet.includes(id));
  }
  if (!choice && Math.random() < diff.ability * 0.22) choice = pick(ready);
  if (choice) {
    activateAbility(p, choice);
    p.aiAbilityClock = rand(1.6, 3.6);
  } else {
    p.aiAbilityClock = rand(0.9, 2.0);
  }
}

/* ==========================================================================
   VISUAL FX HELPERS
   ========================================================================== */
function spawnBurst(x, y, color, count, speed) {
  if (!SAVE.settings.visualFx) return;
  const n = count || 8;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const sp = rand(speed * 0.35, speed);
    MATCH.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.25, 0.6), maxLife: 0.6, size: rand(2, 5), color, drag: 0.93 });
  }
}
function addRing(x, y, color, r0, r1, life, width) {
  MATCH.fx.push({ type: "ring", x, y, color, r0: r0 == null ? 10 : r0, r1: r1 == null ? 80 : r1,
    life: life || 0.5, maxLife: life || 0.5, width: width || 4 });
}
function addText(x, y, text, color) {
  MATCH.fx.push({ type: "text", x, y, text, color: color || "#fff", life: 1.1, maxLife: 1.1, vy: -46 });
}
function addBeam(x1, y1, x2, y2, color, life) {
  MATCH.fx.push({ type: "beam", x1, y1, x2, y2, color, life: life || 0.32, maxLife: life || 0.32 });
}
function spawnBallFire(b) {
  if (!SAVE.settings.visualFx) return;
  MATCH.particles.push({ x: b.pos.x + rand(-5, 5), y: b.pos.y + rand(-5, 5), vx: rand(-30, 30), vy: rand(-70, -20),
    life: 0.35, maxLife: 0.35, size: rand(3, 7), color: pick(["#ffb43c", "#ff6a2b", "#fff0a8"]), drag: 0.95 });
}
function spawnTrailParticle(p) {
  if (!SAVE.settings.visualFx) return;
  const trail = p.look.trail;
  let color = "#ffffff", size = 4, vy = 0;
  if (trail === "sparkle") color = pick(["#ffe66b", "#ffffff", "#ffcf3f"]);
  else if (trail === "bubble") { color = "#9fe6ff"; size = 7; vy = -30; }
  else if (trail === "flame") { color = pick(["#ffb43c", "#ff6a2b", "#ff3d81"]); size = 6; vy = -40; }
  else if (trail === "comet") { color = pick(["#8fe8ff", "#41a8ff", "#ffffff"]); size = 5; }
  else if (trail === "rainbow") color = "hsl(" + ((performance.now() / 8) % 360) + ", 90%, 62%)";
  MATCH.particles.push({ x: p.pos.x + rand(-6, 6), y: p.pos.y + rand(-2, 10), vx: -p.vel.x * 0.08 + rand(-15, 15),
    vy: vy + rand(-15, 15), life: rand(0.25, 0.55), maxLife: 0.55, size, color, drag: 0.94, bubble: trail === "bubble" });
}

/* ==========================================================================
   EXPANSION ABILITY HELPERS
   Shared pieces used by the pack-only abilities added on top of the launch
   set: clone decoys, the portal skip, area shoves and the earthquake burst.
   ========================================================================== */
function pushPlayersAway(x, y, team, radius, force, slowT, color) {
  for (const q of MATCH.players) {
    if (q.team === team) continue;
    const d = dist(q.pos.x, q.pos.y, x, y);
    if (d > radius) continue;
    if (q.buffs.shield > 0) { addRing(q.pos.x, q.pos.y, "#4fb3ff", 14, 52, 0.35); continue; }
    const n = d > 0.001 ? norm(q.pos.x - x, q.pos.y - y) : { x: 0, y: 1 };
    q.vel.x += n.x * force;
    q.vel.y += n.y * force;
    if (slowT) q.buffs.slow = Math.max(q.buffs.slow || 0, slowT);
    spawnBurst(q.pos.x, q.pos.y, color || "#ffffff", 10, 180);
  }
}
function spawnBallFakes(p, b, aim, power) {
  const base = Math.atan2(aim.y, aim.x);
  [-0.4, 0.4].forEach(off => {
    const a = base + off * (p.team === 0 ? 1 : -1);
    MATCH.ballFakes.push({ x: b.pos.x, y: b.pos.y, radius: b.radius, rot: rand(0, TAU),
      vx: Math.cos(a) * power * 0.9, vy: Math.sin(a) * power * 0.9, life: 2, maxLife: 2 });
  });
  if (MATCH.ballFakes.length > 8) MATCH.ballFakes.splice(0, MATCH.ballFakes.length - 8);
  addText(p.pos.x, p.pos.y - 46, "CLONE SHOT", "#c7a6ff");
}
/* The ball blinks forward along its own path — never into either goal, so the
   portal is a reaction killer rather than a free goal. */
function portalJump(p, b) {
  const sp = Math.hypot(b.vel.x, b.vel.y);
  if (sp < 1) return;
  const dir = { x: b.vel.x / sp, y: b.vel.y / sp };
  const fromX = b.pos.x, fromY = b.pos.y;
  const tx = clamp(b.pos.x + dir.x * 150, FIELD.x + b.radius + 3, FIELD.x + FIELD.w - b.radius - 3);
  const ty = clamp(b.pos.y + dir.y * 150, FIELD.y + b.radius + 3, FIELD.y + FIELD.h - b.radius - 3);
  // never blink backwards: near a goal line the clamp would otherwise drag the
  // ball toward its own net, so a short of room just means no jump at all
  if ((tx - fromX) * dir.x + (ty - fromY) * dir.y <= 0) {
    addRing(fromX, fromY, "#ff4d6d", 8, 46, 0.4, 4);
    addText(fromX, fromY - 32, "NO ROOM TO PORTAL", "#ff8f8f");
    return;
  }
  b.pos.x = tx; b.pos.y = ty;
  addRing(fromX, fromY, "#ff4d6d", 8, 46, 0.4, 4);
  addRing(tx, ty, "#ff4d6d", 8, 46, 0.4, 4);
  addBeam(fromX, fromY, tx, ty, "#ff4d6d", 0.26);
  spawnBurst(tx, ty, "#ff4d6d", 16, 240);
  addText(tx, ty - 32, "PORTAL!", "#ff4d6d");
  b.history = [];
}
function fireQuake(b) {
  const q = b.quake;
  if (!q) return;
  b.quake = null;
  pushPlayersAway(b.pos.x, b.pos.y, q.team, 250, 640, 0.6, "#ffb46b");
  addRing(b.pos.x, b.pos.y, "#ffb46b", 16, 250, 0.55, 7);
  addText(b.pos.x, b.pos.y - 34, "QUAKE!", "#ffb46b");
  MATCH.shakeT = Math.max(MATCH.shakeT, 0.24);
  MATCH.shakeMag = Math.max(MATCH.shakeMag, 5);
  Sound.play("block");
}
/* One-shot wall bounce: a ricochet keeps nearly all of its speed, anything
   else is the usual soft arena bounce. */
function ballBounce(b, hit) {
  const base = isBounceMode() ? 0.97 : 0.66;
  if (!hit) return base;
  if (b.ricochet > 0) {
    b.ricochet--;
    spawnBurst(b.pos.x, b.pos.y, "#ffd479", 12, 200);
    addRing(b.pos.x, b.pos.y, "#ffd479", 10, 46, 0.3);
    addText(b.pos.x, b.pos.y - 30, "RICOCHET!", "#ffd479");
    if (b.quake) fireQuake(b);
    return isBounceMode() ? 0.99 : 0.96;
  }
  if (b.quake) fireQuake(b);
  return base;
}

/* ==========================================================================
   ABILITY RUNTIME — all 30, 2D only
   ========================================================================== */
function safeSpot(x, y, radius, ignore) {
  const r = radius || PLAYER_R;
  const ignoreList = Array.isArray(ignore) ? ignore : (ignore ? [ignore] : []);
  if (x < FIELD.x + r + 4 || x > FIELD.x + FIELD.w - r - 4) return false;
  if (y < FIELD.y + r + 4 || y > FIELD.y + FIELD.h - r - 4) return false;
  for (const q of MATCH.players) {
    if (ignoreList.includes(q)) continue;
    if (dist(x, y, q.pos.x, q.pos.y) < r + q.radius + 6) return false;
  }
  for (const wall of MATCH.barriers) {
    if (x > wall.x - r && x < wall.x + wall.w + r && y > wall.y - r && y < wall.y + wall.h + r) return false;
  }
  return true;
}
function activateAbility(p, id, opts) {
  if (MATCH.state !== "playing" || MATCH.paused) return false;
  const ab = ABIL_BY_ID[id];
  if (!ab) return false;
  const chargeKey = (opts && opts.chargeKey) || id;
  const cooldown = opts && opts.cd != null ? opts.cd : ab.cd;
  if ((p.cooldowns[chargeKey] || 0) > 0) return false;
  const b = MATCH.ball;
  if (!b) return false;
  const oppGoal = oppGoalCenter(p.team);
  let ok = false;

  switch (id) {
    case "power":
      p.buffs.power = 5;
      addText(p.pos.x, p.pos.y - 46, "POWER READY", "#ff8f3d");
      spawnBurst(p.pos.x, p.pos.y, "#ff8f3d", 12, 180);
      ok = true; break;
    case "curve":
      p.buffs.curve = 5;
      addText(p.pos.x, p.pos.y - 46, "CURVE READY", "#57d6ff");
      addRing(p.pos.x, p.pos.y, "#57d6ff", 20, 66, 0.4);
      ok = true; break;
    case "flame":
      p.buffs.flame = 5;
      p.buffs.sprint = Math.max(p.buffs.sprint || 0, 1.6);
      addText(p.pos.x, p.pos.y - 46, "FLAME READY", "#ff6a2b");
      spawnBurst(p.pos.x, p.pos.y, "#ff6a2b", 14, 200);
      ok = true; break;
    case "double":
      p.buffs.double = 5;
      addText(p.pos.x, p.pos.y - 46, "DOUBLE KICK", "#ffd23f");
      ok = true; break;
    case "lightning": {
      const d = dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y);
      addBeam(p.pos.x, p.pos.y, b.pos.x, b.pos.y, "#aef2ff", 0.3);
      if (d < 170) {
        const aim = shotAim(p);
        applyKickImpulse(p, b, aim, 1780, { color: "#aef2ff" });
        MATCH.shots++;
        spawnBurst(b.pos.x, b.pos.y, "#aef2ff", 18, 340);
      } else {
        p.buffs.lightning = 4;
        addText(p.pos.x, p.pos.y - 46, "CHARGED KICK", "#aef2ff");
      }
      ok = true; break;
    }
    case "teleport": {
      const n = norm(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
      const tries = [150, 110, 70, 40];
      let moved = false;
      for (const d of tries) {
        const tx = p.pos.x + n.x * d, ty = p.pos.y + n.y * d;
        if (safeSpot(tx, ty, p.radius, p)) {
          addBeam(p.pos.x, p.pos.y, tx, ty, "#b46bff", 0.25);
          spawnBurst(p.pos.x, p.pos.y, "#b46bff", 14, 220);
          p.pos.x = tx; p.pos.y = ty;
          p.vel.x = 0; p.vel.y = 0;
          spawnBurst(tx, ty, "#ff9ee0", 14, 220);
          moved = true;
          break;
        }
      }
      if (!moved) { addText(p.pos.x, p.pos.y - 42, "NO SAFE SPOT", "#ff8f8f"); return false; }
      ok = true; break;
    }
    case "dash": {
      const n = kickAim(p);
      p.vel.x = n.x * 780; p.vel.y = n.y * 780;
      p.buffs.dash = 0.22;
      spawnBurst(p.pos.x, p.pos.y, "#8fe8ff", 14, 240);
      MATCH.fx.push({ type: "dash", x: p.pos.x, y: p.pos.y, dx: n.x, dy: n.y, life: 0.25, maxLife: 0.25, color: "#8fe8ff" });
      ok = true; break;
    }
    case "blink": {
      const n = kickAim(p);
      const tries = [130, 100, 70];
      let moved = false;
      for (const d of tries) {
        const tx = p.pos.x + n.x * d, ty = p.pos.y + n.y * d;
        if (safeSpot(tx, ty, p.radius, p)) {
          addBeam(p.pos.x, p.pos.y, tx, ty, "#ff9ee0", 0.25);
          p.pos.x = tx; p.pos.y = ty;
          p.vel.x = 0; p.vel.y = 0;
          spawnBurst(tx, ty, "#ff9ee0", 12, 220);
          moved = true; break;
        }
      }
      if (!moved) { addText(p.pos.x, p.pos.y - 42, "WALL IN THE WAY", "#ff8f8f"); return false; }
      ok = true; break;
    }
    case "magnetboots":
      p.buffs.magnetboots = 3.5;
      addRing(p.pos.x, p.pos.y, "#ff5d8f", 12, 120, 0.5);
      ok = true; break;
    case "sprint":
      p.buffs.sprint = 3.5;
      addText(p.pos.x, p.pos.y - 46, "SPRINT!", "#48e08a");
      spawnBurst(p.pos.x, p.pos.y, "#48e08a", 10, 180);
      ok = true; break;
    case "shield":
      p.buffs.shield = 4;
      addRing(p.pos.x, p.pos.y, "#4fb3ff", 16, 58, 0.5);
      addText(p.pos.x, p.pos.y - 46, "SHIELD UP", "#4fb3ff");
      ok = true; break;
    case "goalwall": {
      const left = p.team === 0;
      MATCH.barriers.push({
        x: left ? FIELD.x + 76 : FIELD.x + FIELD.w - 100,
        y: CY - 130, w: 24, h: 260, life: 5, maxLife: 5, team: p.team, color: "#ffb46b"
      });
      addRing(left ? FIELD.x + 90 : FIELD.x + FIELD.w - 90, CY, "#ffb46b", 30, 180, 0.6);
      addText(p.pos.x, p.pos.y - 46, "GOAL WALL", "#ffb46b");
      ok = true; break;
    }
    case "freeze":
      b.frozen = 1.1;
      b.vel.x = 0; b.vel.y = 0;
      b.stick = null;
      addRing(b.pos.x, b.pos.y, "#9fe6ff", 10, 70, 0.5);
      spawnBurst(b.pos.x, b.pos.y, "#9fe6ff", 18, 200);
      addText(b.pos.x, b.pos.y - 34, "FROZEN", "#9fe6ff");
      ok = true; break;
    case "superblock":
      p.buffs.superblock = 3;
      addRing(p.pos.x, p.pos.y, "#ffd166", 24, 70, 0.5);
      addText(p.pos.x, p.pos.y - 46, "BIG WALL", "#ffd166");
      ok = true; break;
    case "keeper":
      p.buffs.keeper = 3.5;
      addRing(p.pos.x, p.pos.y, "#7bffcf", 20, 110, 0.5);
      addText(p.pos.x, p.pos.y - 46, "KEEPER MODE", "#7bffcf");
      ok = true; break;
    case "fake":
      p.fakeTimer = 0.42;
      p.fakeDir = shotAim(p);
      p.kickAnim = 0.3;
      addText(p.pos.x, p.pos.y - 46, "FAKE!", "#d3a0ff");
      addRing(p.pos.x, p.pos.y, "#d3a0ff", 12, 52, 0.35);
      ok = true; break;
    case "gravity":
      p.buffs.gravity = 2.6;
      addRing(p.pos.x, p.pos.y, "#a06bff", 20, 280, 0.6);
      ok = true; break;
    case "recall": {
      const hist = b.history;
      let target = null;
      if (hist && hist.length > 3) {
        target = hist[Math.max(0, hist.length - 16)];
      }
      addBeam(b.pos.x, b.pos.y, target ? target.x : b.pos.x, target ? target.y : b.pos.y, "#5affd6", 0.3);
      if (target && Math.hypot(target.x - b.pos.x, target.y - b.pos.y) > 4) {
        const n = norm(target.x - b.pos.x, target.y - b.pos.y);
        b.vel.x = n.x * 860; b.vel.y = n.y * 860;
      } else {
        b.vel.x = -b.vel.x * 0.85;
        b.vel.y = -b.vel.y * 0.85;
      }
      b.stick = null; b.dribble = null;
      spawnBurst(b.pos.x, b.pos.y, "#5affd6", 16, 240);
      addText(b.pos.x, b.pos.y - 32, "RECALL", "#5affd6");
      ok = true; break;
    }
    case "sticky": {
      if (dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) > 150) {
        addText(p.pos.x, p.pos.y - 42, "GET CLOSER", "#ff8f8f");
        return false;
      }
      b.dribble = null;
      b.stick = p; b.stickTimer = 1.1; b.frozen = 0;
      addRing(b.pos.x, b.pos.y, "#ff8ad8", 10, 46, 0.4);
      addText(p.pos.x, p.pos.y - 46, "STICKY!", "#ff8ad8");
      ok = true; break;
    }
    case "chaos":
      b.chaos = 2.5;
      addRing(b.pos.x, b.pos.y, "#ff5f5f", 10, 80, 0.5);
      addText(b.pos.x, b.pos.y - 34, "CHAOS BALL", "#ff5f5f");
      ok = true; break;
    case "shockwave": {
      const hit = MATCH.players.filter(q => q.team !== p.team && dist(q.pos.x, q.pos.y, p.pos.x, p.pos.y) < 240);
      for (const q of hit) {
        if (q.buffs.shield > 0) { addRing(q.pos.x, q.pos.y, "#4fb3ff", 14, 52, 0.35); continue; }
        const n = norm(q.pos.x - p.pos.x, q.pos.y - p.pos.y);
        q.vel.x += n.x * 620; q.vel.y += n.y * 620;
        q.buffs.slow = Math.max(q.buffs.slow || 0, 0.6);
        spawnBurst(q.pos.x, q.pos.y, "#63e0ff", 10, 180);
      }
      addRing(p.pos.x, p.pos.y, "#63e0ff", 20, 240, 0.55, 7);
      addText(p.pos.x, p.pos.y - 46, "SHOCKWAVE", "#63e0ff");
      ok = true; break;
    }
    case "swap": {
      const mate = MATCH.players.find(q => q.team === p.team && q.id !== p.id);
      if (!mate) { addText(p.pos.x, p.pos.y - 42, "NO TEAMMATE", "#ff8f8f"); return false; }
      if (!safeSpot(mate.pos.x, mate.pos.y, p.radius, [p, mate]) || !safeSpot(p.pos.x, p.pos.y, mate.radius, [p, mate])) {
        addText(p.pos.x, p.pos.y - 42, "NO ROOM TO SWAP", "#ff8f8f"); return false;
      }
      const px = p.pos.x, py = p.pos.y;
      p.pos.x = mate.pos.x; p.pos.y = mate.pos.y;
      mate.pos.x = px; mate.pos.y = py;
      p.vel.x = p.vel.y = mate.vel.x = mate.vel.y = 0;
      addBeam(px, py, p.pos.x, p.pos.y, "#ffd166", 0.3);
      spawnBurst(px, py, "#ffd166", 12, 200);
      spawnBurst(p.pos.x, p.pos.y, "#ffd166", 12, 200);
      addText(p.pos.x, p.pos.y - 44, "SWAP", "#ffd166");
      ok = true; break;
    }
    case "clone":
      MATCH.clones.push({ x: p.pos.x + (p.team === 0 ? -26 : 26), y: p.pos.y + 30, team: p.team,
        life: 5, maxLife: 5, bob: 0, look: { color: p.look.color, hat: p.look.hat, trail: "none", glow: "none" },
        face: p.face });
      addText(p.pos.x, p.pos.y - 46, "DECOY!", "#c7a6ff");
      spawnBurst(p.pos.x, p.pos.y + 30, "#c7a6ff", 16, 200);
      ok = true; break;
    case "teamboost": {
      MATCH.players.filter(q => q.team === p.team).forEach(q => {
        q.buffs.boost = 4;
        addRing(q.pos.x, q.pos.y, "#7bffb0", 16, 54, 0.4);
      });
      addText(p.pos.x, p.pos.y - 46, "TEAM BOOST", "#7bffb0");
      ok = true; break;
    }
    case "reverse": {
      const hit = MATCH.players.filter(q => q.team !== p.team && dist(q.pos.x, q.pos.y, p.pos.x, p.pos.y) < 280);
      for (const q of hit) {
        if (q.buffs.shield > 0) continue;
        q.buffs.reverse = 3;
        addRing(q.pos.x, q.pos.y, "#ff7bd5", 12, 44, 0.35);
      }
      addRing(p.pos.x, p.pos.y, "#ff7bd5", 20, 280, 0.5, 5);
      addText(p.pos.x, p.pos.y - 46, "REVERSED", "#ff7bd5");
      ok = true; break;
    }
    case "rocket":
      p.buffs.rocket = 6;
      addText(p.pos.x, p.pos.y - 46, "ROCKET LOADED", "#ffb43c");
      addRing(p.pos.x, p.pos.y, "#ffb43c", 16, 60, 0.45);
      ok = true; break;
    case "minigoal":
      if (MATCH.miniGoal && !MATCH.miniGoal.used) { addText(p.pos.x, p.pos.y - 42, "ONE TARGET AT A TIME", "#ff8f8f"); return false; }
      MATCH.miniGoal = miniGoalForTeam(p.team);
      addText(MATCH.miniGoal.x, MATCH.miniGoal.y, "BONUS TARGET", "#ffcf3f");
      addRing(MATCH.miniGoal.x, MATCH.miniGoal.y, "#ffcf3f", 20, 120, 0.6);
      ok = true; break;
    case "timeslow": {
      const hit = MATCH.players.filter(q => q.team !== p.team && dist(q.pos.x, q.pos.y, p.pos.x, p.pos.y) < 340);
      for (const q of hit) {
        if (q.buffs.shield > 0) continue;
        q.buffs.slow = 3;
        addRing(q.pos.x, q.pos.y, "#9fd0ff", 12, 44, 0.35);
      }
      addRing(p.pos.x, p.pos.y, "#9fd0ff", 24, 340, 0.6, 4);
      addText(p.pos.x, p.pos.y - 46, "TIME SLOW", "#9fd0ff");
      ok = true; break;
    }
    case "ballmagnet": {
      const n = kickAim(p);
      const x = clamp(p.pos.x + n.x * 250, FIELD.x + 30, FIELD.x + FIELD.w - 30);
      const y = clamp(p.pos.y + n.y * 250, FIELD.y + 30, FIELD.y + FIELD.h - 30);
      MATCH.magnetPoints.push({ x, y, life: 1.5, maxLife: 1.5, force: 1000, color: "#4be0a5", team: p.team });
      addRing(x, y, "#4be0a5", 10, 90, 0.5);
      addBeam(p.pos.x, p.pos.y, x, y, "#4be0a5", 0.3);
      ok = true; break;
    }
    case "pulse": {
      const d = dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y);
      if (d < 230) {
        const n = norm(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
        b.vel.x = n.x * 980 + p.vel.x * 0.3;
        b.vel.y = n.y * 980 + p.vel.y * 0.3;
        b.stick = null; b.dribble = null;
        spawnBurst(b.pos.x, b.pos.y, "#ffe66b", 16, 260);
      }
      for (const q of MATCH.players) {
        if (q === p || q.team === p.team) continue;
        if (dist(q.pos.x, q.pos.y, p.pos.x, p.pos.y) < 230) {
          if (q.buffs.shield > 0) continue;
          const n = norm(q.pos.x - p.pos.x, q.pos.y - p.pos.y);
          q.vel.x += n.x * 520; q.vel.y += n.y * 520;
        }
      }
      addRing(p.pos.x, p.pos.y, "#ffe66b", 18, 230, 0.5, 6);
      addText(p.pos.x, p.pos.y - 46, "PULSE", "#ffe66b");
      ok = true; break;
    }

    /* ---- expansion set: all of these load your next kick ---- */
    case "thunder":
      p.buffs.thunder = 6;
      addText(p.pos.x, p.pos.y - 46, "THUNDER READY", "#c9f0ff");
      addRing(p.pos.x, p.pos.y, "#c9f0ff", 16, 62, 0.45);
      ok = true; break;
    case "boomerang":
      p.buffs.boomerang = 6;
      addText(p.pos.x, p.pos.y - 46, "BOOMERANG READY", "#7bffcf");
      addRing(p.pos.x, p.pos.y, "#7bffcf", 16, 62, 0.45);
      ok = true; break;
    case "ricochet":
      p.buffs.ricochet = 6;
      addText(p.pos.x, p.pos.y - 46, "RICOCHET READY", "#ffd479");
      addRing(p.pos.x, p.pos.y, "#ffd479", 16, 62, 0.45);
      ok = true; break;
    case "cloneshot":
      p.buffs.cloneshot = 6;
      addText(p.pos.x, p.pos.y - 46, "CLONE SHOT READY", "#c7a6ff");
      addRing(p.pos.x, p.pos.y, "#c7a6ff", 16, 62, 0.45);
      ok = true; break;
    case "portal":
      p.buffs.portal = 6;
      addText(p.pos.x, p.pos.y - 46, "PORTAL READY", "#ff4d6d");
      addRing(p.pos.x, p.pos.y, "#ff4d6d", 16, 66, 0.45);
      ok = true; break;
    case "phoenix":
      p.buffs.phoenix = 6;
      addText(p.pos.x, p.pos.y - 46, "PHOENIX READY", "#ff8f3d");
      addRing(p.pos.x, p.pos.y, "#ff8f3d", 16, 66, 0.45);
      ok = true; break;
    case "gravityball":
      p.buffs.gravityball = 6;
      addText(p.pos.x, p.pos.y - 46, "GRAVITY BALL READY", "#a06bff");
      addRing(p.pos.x, p.pos.y, "#a06bff", 16, 66, 0.45);
      ok = true; break;
    case "phantom":
      p.buffs.phantom = 6;
      addText(p.pos.x, p.pos.y - 46, "PHANTOM READY", "#c9b6ff");
      addRing(p.pos.x, p.pos.y, "#c9b6ff", 16, 66, 0.45);
      ok = true; break;
    case "tornado":
      p.buffs.tornado = 6;
      addText(p.pos.x, p.pos.y - 46, "TORNADO READY", "#9fd0ff");
      addRing(p.pos.x, p.pos.y, "#9fd0ff", 16, 66, 0.45);
      ok = true; break;
    case "shieldball":
      p.buffs.shieldball = 6;
      addText(p.pos.x, p.pos.y - 46, "SHIELD BALL READY", "#4fb3ff");
      addRing(p.pos.x, p.pos.y, "#4fb3ff", 16, 62, 0.45);
      ok = true; break;
    case "sonic":
      p.buffs.sonic = 6;
      addText(p.pos.x, p.pos.y - 46, "SONIC READY", "#63e0ff");
      addRing(p.pos.x, p.pos.y, "#63e0ff", 16, 62, 0.45);
      ok = true; break;
    case "quake":
      p.buffs.quake = 6;
      addText(p.pos.x, p.pos.y - 46, "QUAKE READY", "#ffb46b");
      addRing(p.pos.x, p.pos.y, "#ffb46b", 16, 62, 0.45);
      ok = true; break;
    case "magneticsteal": {
      const holder = b.dribble;
      const inGoal = b.pos.x < FIELD.x + 4 || b.pos.x > FIELD.x + FIELD.w - 4;
      if (inGoal) { addText(p.pos.x, p.pos.y - 42, "NOT IN A GOAL", "#ff8f8f"); return false; }
      if (dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) > 130) {
        addText(p.pos.x, p.pos.y - 42, "GET CLOSER", "#ff8f8f"); return false;
      }
      addBeam(b.pos.x, b.pos.y, p.pos.x, p.pos.y, "#ff5d8f", 0.3);
      b.stick = null; b.stickTimer = 0; b.dribble = null; b.holdGrace = 0; b.boomerang = null;
      if (holder && holder.team !== p.team) {
        holder.captureCd = 0.55;
        b.noCapture = holder; b.noCaptureT = 0.55;
        addText(holder.pos.x, holder.pos.y - 44, "STOLEN", "#ff5d8f");
      }
      const aim = kickAim(p);
      const off = p.radius + b.radius + 2;
      b.pos.x = clamp(p.pos.x + aim.x * off, FIELD.x + b.radius, FIELD.x + FIELD.w - b.radius);
      b.pos.y = clamp(p.pos.y + aim.y * off, FIELD.y + b.radius, FIELD.y + FIELD.h - b.radius);
      b.vel.x = p.vel.x; b.vel.y = p.vel.y;
      b.lastTouch = p;
      spawnBurst(b.pos.x, b.pos.y, "#ff5d8f", 16, 220);
      addRing(b.pos.x, b.pos.y, "#ff5d8f", 12, 60, 0.4);
      ok = true; break;
    }
    default: break;
  }
  if (!ok) return false;
  p.cooldowns[chargeKey] = cooldown;
  MATCH.abilityUses++;
  Sound.play("ability");
  addRing(p.pos.x, p.pos.y, ab.color, p.radius + 4, p.radius + 46, 0.4, 3);
  updateAbilityHud();
  return true;
}

/* ==========================================================================
   RENDERER
   ========================================================================== */
function hexToRgb(hex) {
  const h = String(hex || "#2ee6c5").replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (isNaN(n)) return { r: 46, g: 230, b: 197 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex, amt) {
  const c = hexToRgb(hex);
  const f = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return "rgb(" + f(c.r) + "," + f(c.g) + "," + f(c.b) + ")";
}
function withAlpha(hex, a) {
  const c = hexToRgb(hex);
  return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
}

/* ---------- hats, drawn as flat 2D shapes attached to the head ---------- */
function drawHat(ctx, kind, r, baseColor, facing) {
  if (!kind || kind === "none") return;
  const top = -r * 0.94;
  const fx = clamp(facing.x || 0, -1, 1);
  ctx.save();
  ctx.lineJoin = "round";
  if (kind === "cap") {
    ctx.fillStyle = shade(baseColor, -0.5);
    ctx.beginPath();
    ctx.ellipse(fx * r * 0.28, top + r * 0.18, r * 0.62, r * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade(baseColor, -0.35);
    ctx.beginPath();
    ctx.arc(0, top + r * 0.18, r * 0.52, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = shade(baseColor, 0.55);
    ctx.beginPath();
    ctx.arc(0, top + r * 0.02, r * 0.09, 0, TAU);
    ctx.fill();
  } else if (kind === "beanie") {
    ctx.fillStyle = shade(baseColor, 0.12);
    ctx.beginPath();
    ctx.arc(0, top + r * 0.28, r * 0.6, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    ctx.arc(0, top + r * 0.28, r * 0.6, Math.PI, TAU);
    ctx.clip();
    ctx.fillRect(-r * 0.6, top + r * 0.2, r * 1.2, r * 0.12);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = shade(baseColor, 0.4);
    ctx.beginPath();
    ctx.arc(0, top - r * 0.24, r * 0.16, 0, TAU);
    ctx.fill();
  } else if (kind === "headband") {
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.arc(0, -r * 0.22, r * 0.93, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.arc(0, -r * 0.22, r * 0.9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (kind === "antenna") {
    ctx.strokeStyle = "#c7d3f2";
    ctx.lineWidth = r * 0.07;
    [-1, 1].forEach((s, i) => {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.22, top + r * 0.34);
      ctx.quadraticCurveTo(s * r * 0.5, top - r * 0.1, s * r * 0.42, top - r * 0.36);
      ctx.stroke();
      ctx.fillStyle = i === 0 ? baseColor : shade(baseColor, 0.35);
      ctx.beginPath();
      ctx.arc(s * r * 0.42, top - r * 0.4, r * 0.12, 0, TAU);
      ctx.fill();
    });
  } else if (kind === "headphones") {
    ctx.strokeStyle = shade(baseColor, -0.55);
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(0, top + r * 0.4, r * 0.86, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.fillStyle = baseColor;
    [-1, 1].forEach(s => {
      roundRect(ctx, s * r * 0.86 - r * 0.16, top + r * 0.28, r * 0.32, r * 0.5, r * 0.12);
      ctx.fill();
    });
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.86, top + r * 0.53, r * 0.06, 0, TAU);
    ctx.fill();
  } else if (kind === "crown") {
    ctx.fillStyle = baseColor;
    ctx.strokeStyle = shade(baseColor, -0.45);
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, top + r * 0.34);
    ctx.lineTo(-r * 0.55, top - r * 0.06);
    ctx.lineTo(-r * 0.26, top + r * 0.13);
    ctx.lineTo(0, top - r * 0.16);
    ctx.lineTo(r * 0.26, top + r * 0.13);
    ctx.lineTo(r * 0.55, top - r * 0.06);
    ctx.lineTo(r * 0.55, top + r * 0.34);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ff3d81";
    ctx.beginPath(); ctx.arc(0, top + r * 0.18, r * 0.08, 0, TAU); ctx.fill();
  } else if (kind === "tophat") {
    ctx.fillStyle = shade(baseColor, -0.62);
    ctx.beginPath();
    ctx.ellipse(0, top + r * 0.3, r * 0.7, r * 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade(baseColor, -0.38);
    roundRect(ctx, -r * 0.4, top - r * 0.5, r * 0.8, r * 0.8, r * 0.08);
    ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.fillRect(-r * 0.4, top + r * 0.05, r * 0.8, r * 0.12);
  } else if (kind === "wizard") {
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, top + r * 0.34);
    ctx.quadraticCurveTo(-r * 0.2, top - r * 0.2, r * 0.06, top - r * 0.72);
    ctx.quadraticCurveTo(r * 0.34, top - r * 0.1, r * 0.62, top + r * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(r * 0.04, top + r * 0.02, r * 0.08, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = r * 0.03;
    ctx.beginPath();
    ctx.moveTo(r * 0.04, top - r * 0.16);
    ctx.lineTo(r * 0.04, top + r * 0.2);
    ctx.moveTo(-r * 0.1, top + r * 0.02);
    ctx.lineTo(r * 0.18, top + r * 0.02);
    ctx.stroke();
  } else if (kind === "halo") {
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = r * 0.11;
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = r * 0.5;
    ctx.beginPath();
    ctx.ellipse(0, top - r * 0.12, r * 0.55, r * 0.17, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- character ---------- */
function drawCharacter(ctx, x, y, r, opts) {
  const look = opts.look || {};
  const color = look.color || "#2ee6c5";
  const face = opts.face || "happy";
  const facing = opts.facing || { x: 0.4, y: 0.3 };
  const time = opts.time || 0;
  const bob = Math.sin(time * (opts.preview ? 1.6 : 7) + (opts.seed || 0)) * r * 0.03;
  const fx = clamp(facing.x || 0, -1, 1);
  const fy = clamp(facing.y || 0, -1, 1);
  const eyes = opts.eyes || "#101a2e";

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.92, r * 0.82, r * 0.28, 0, 0, TAU);
  ctx.fill();

  // trails (preview only; match trails are particles)
  if (opts.preview && look.trail && look.trail !== "none") {
    for (let i = 5; i >= 1; i--) {
      const tx = -i * r * 0.42, ty = i * r * 0.18;
      const rad = r * (0.44 - i * 0.045);
      let c = "#ffffff";
      if (look.trail === "flame") c = ["#ffb43c", "#ff6a2b", "#ff3d81"][i % 3];
      else if (look.trail === "sparkle") c = ["#ffe66b", "#ffffff", "#ffcf3f"][i % 3];
      else if (look.trail === "bubble") c = "#9fe6ff";
      else if (look.trail === "comet") c = ["#8fe8ff", "#41a8ff"][i % 2];
      else if (look.trail === "rainbow") c = "hsl(" + ((i * 55 + time * 50) % 360) + ",90%,62%)";
      ctx.globalAlpha = 0.24 * (6 - i) / 5;
      if (look.trail === "bubble") {
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, r * 0.05);
        ctx.beginPath(); ctx.arc(tx, ty, rad, 0, TAU); ctx.stroke();
      } else {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(tx, ty, rad * 0.6, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // glow
  const glowKind = look.glow || "none";
  if (glowKind !== "none") {
    const pulse = 0.5 + Math.sin(time * 4) * 0.5;
    if (glowKind === "neon" || glowKind === "pulse" || glowKind === "aura") {
      const grad = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * (glowKind === "aura" ? 1.9 : 1.45));
      grad.addColorStop(0, withAlpha(color, glowKind === "pulse" ? 0.55 + pulse * 0.3 : 0.5));
      grad.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, r * (glowKind === "aura" ? 1.9 : 1.45), 0, TAU); ctx.fill();
    }
    if (glowKind === "double" || glowKind === "pulse") {
      ctx.strokeStyle = withAlpha(color, 0.6 + pulse * 0.3);
      ctx.lineWidth = Math.max(1.5, r * 0.075);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.28, 0, TAU); ctx.stroke();
    }
    if (glowKind === "aura") {
      ctx.strokeStyle = withAlpha(color, 0.35 + pulse * 0.3);
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.55 + pulse * r * 0.1, 0, TAU); ctx.stroke();
    }
  }

  // team marker ring
  if (opts.teamColor) {
    ctx.strokeStyle = withAlpha(opts.teamColor, 0.85);
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, TAU); ctx.stroke();
  }

  // body
  const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.12, 0, 0, r * 1.02);
  bg.addColorStop(0, shade(color, 0.5));
  bg.addColorStop(0.62, color);
  bg.addColorStop(1, shade(color, -0.28));
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = withAlpha(shade(color, -0.55), 0.9);
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.stroke();

  // face
  const eyeX = r * 0.3, eyeY = -r * 0.12;
  ctx.fillStyle = "#ffffff";
  if (face === "chill") {
    ctx.strokeStyle = eyes;
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(-eyeX - r * 0.13, eyeY); ctx.lineTo(-eyeX + r * 0.13, eyeY);
    ctx.moveTo(eyeX - r * 0.13, eyeY); ctx.lineTo(eyeX + r * 0.13, eyeY);
    ctx.stroke();
  } else if (face === "royal") {
    ctx.strokeStyle = eyes;
    ctx.lineWidth = r * 0.07;
    [-1, 1].forEach(s => {
      ctx.beginPath();
      ctx.arc(s * eyeX, eyeY, r * 0.15, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
  } else if (face === "spark") {
    [-1, 1].forEach(s => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(s * eyeX, eyeY, r * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = eyes;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * TAU / 5;
        const rr = i % 2 === 0 ? r * 0.12 : r * 0.05;
        ctx.lineTo(s * eyeX + Math.cos(a) * rr, eyeY + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    });
  } else if (face === "mystic") {
    [-1, 1].forEach(s => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(s * eyeX, eyeY, r * 0.19, 0, TAU); ctx.fill();
      ctx.fillStyle = "#7b5cff";
      ctx.beginPath(); ctx.arc(s * eyeX + fx * r * 0.04, eyeY, r * 0.1, 0, TAU); ctx.fill();
    });
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.arc(0, r * 0.34, r * 0.1, 0, TAU); ctx.stroke();
  } else {
    [-1, 1].forEach(s => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(s * eyeX, eyeY, r * 0.19, r * 0.22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = eyes;
      ctx.beginPath();
      ctx.arc(s * eyeX + fx * r * 0.07, eyeY + fy * r * 0.05, r * 0.1, 0, TAU);
      ctx.fill();
    });
  }

  // eyebrows / expression
  ctx.strokeStyle = "rgba(10,20,40,.5)";
  ctx.lineWidth = Math.max(1, r * 0.055);
  if (face === "focused" || face === "spark") {
    ctx.beginPath();
    ctx.moveTo(-eyeX - r * 0.14, eyeY - r * 0.3); ctx.lineTo(-eyeX + r * 0.14, eyeY - r * 0.22);
    ctx.moveTo(eyeX - r * 0.14, eyeY - r * 0.22); ctx.lineTo(eyeX + r * 0.14, eyeY - r * 0.3);
    ctx.stroke();
  }

  // mouth
  ctx.strokeStyle = "rgba(12,22,42,.75)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  if (face === "cheeky") {
    ctx.beginPath(); ctx.arc(fx * r * 0.08, r * 0.28, r * 0.22, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.fillStyle = "#ff7a9c";
    ctx.beginPath(); ctx.ellipse(fx * r * 0.08, r * 0.42, r * 0.09, r * 0.07, 0, 0, TAU); ctx.fill();
  } else if (face === "focused") {
    ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.33); ctx.lineTo(r * 0.12, r * 0.33); ctx.stroke();
  } else if (face === "mystic") {
    // drawn above
  } else {
    ctx.beginPath(); ctx.arc(fx * r * 0.05, r * 0.2, r * 0.16, 0.25, Math.PI - 0.25); ctx.stroke();
  }

  // cheeks
  if (face === "happy" || face === "cheeky") {
    ctx.fillStyle = "rgba(255,110,150,.28)";
    [-1, 1].forEach(s => {
      ctx.beginPath(); ctx.ellipse(s * r * 0.52, r * 0.18, r * 0.12, r * 0.07, 0, 0, TAU); ctx.fill();
    });
  }

  drawHat(ctx, look.hat, r, look.hatColor || color, facing);

  // active ability visuals
  const buffs = opts.buffs || {};
  if (buffs.shield > 0) {
    const p = 0.5 + Math.sin(time * 8) * 0.5;
    ctx.strokeStyle = withAlpha("#4fb3ff", 0.65 + p * 0.3);
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, TAU); ctx.stroke();
  }
  if (buffs.superblock > 0) {
    ctx.strokeStyle = withAlpha("#ffd166", 0.75);
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.setLineDash([r * 0.3, r * 0.22]);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (buffs.keeper > 0) {
    ctx.strokeStyle = withAlpha("#7bffcf", 0.8);
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.22, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
  }
  if (buffs.sprint > 0 || buffs.dash > 0 || buffs.boost > 0) {
    ctx.strokeStyle = withAlpha(buffs.boost > 0 ? "#7bffb0" : "#8fe8ff", 0.6);
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    const dirx = Math.abs(facing.x) > Math.abs(facing.y) ? Math.sign(facing.x) : 0;
    const diry = dirx === 0 ? Math.sign(facing.y) : 0;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-dirx * (r + i * 7), -diry * (r + i * 7) - r * 0.3);
      ctx.lineTo(-dirx * (r + 6 + i * 7), -diry * (r + 6 + i * 7) + r * 0.3);
      ctx.stroke();
    }
  }
  if (buffs.slow > 0) {
    ctx.strokeStyle = "rgba(159,214,255,.7)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = time * 1.4 + i * TAU / 4;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.38, a, a + 0.4); ctx.stroke();
    }
  }
  if (buffs.reverse > 0) {
    ctx.strokeStyle = "rgba(255,123,213,.8)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0.4, 2.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 3.6, 5.6); ctx.stroke();
  }
  if (buffs.power > 0 || buffs.rocket > 0 || buffs.flame > 0 || buffs.lightning > 0 || buffs.curve > 0 || buffs.double > 0) {
    const icon = buffs.rocket > 0 ? "🚀" : buffs.power > 0 ? "💥" : buffs.flame > 0 ? "🔥" : buffs.lightning > 0 ? "⚡" : buffs.curve > 0 ? "🌀" : "⏫";
    ctx.font = Math.max(12, r * 0.72) + "px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, 0, -r * 1.72);
  }

  // kick swipe
  if (opts.kickAnim > 0) {
    const k = opts.kickAnim / 0.22;
    ctx.strokeStyle = "rgba(255,255,255," + (0.7 * k) + ")";
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    const ang = Math.atan2(facing.y, facing.x);
    ctx.arc(0, 0, r * 1.4, ang - 0.6 * k, ang + 0.6 * k);
    ctx.stroke();
  }
  ctx.restore();

  // labels are drawn upright in world space
  if (opts.label) {
    ctx.save();
    ctx.font = "800 13px 'Trebuchet MS', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(opts.label).width + 14;
    ctx.fillStyle = "rgba(6,11,24,.72)";
    ctx.strokeStyle = withAlpha(opts.teamColor || "#ffffff", 0.7);
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - w / 2, y - r * 1.25 - 18, w, 18, 9);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#eaf2ff";
    ctx.fillText(opts.label, x, y - r * 1.25 - 9);
    ctx.restore();
  }
}

/* ---------- preview canvas ---------- */
function drawAvatarPreview(canvas, char, look, zoom) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.56;
  const r = Math.min(w, h) * 0.2 * (zoom || 1);
  const time = performance.now() / 1000;
  // backdrop rings
  const grad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 3.1);
  grad.addColorStop(0, withAlpha(look.color || char.color, 0.25));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r * 3.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.95, r * 1.15, 0, TAU); ctx.stroke();
  // sparkles
  for (let i = 0; i < 7; i++) {
    const a = time * 0.5 + i * TAU / 7;
    const rr = r * (1.9 + Math.sin(time + i) * 0.18);
    ctx.fillStyle = "rgba(255,255,255," + (0.25 + 0.2 * Math.sin(time * 2 + i)) + ")";
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5, 2, 0, TAU); ctx.fill();
  }
  drawCharacter(ctx, cx, cy, r, { look: look, face: (char && char.face) || "happy", facing: { x: 0.35, y: 0.25 }, preview: true, time: time, seed: 1 });
  drawPreviewBall(ctx, w * 0.8, h * 0.79, Math.max(13, r * 0.36), look.ballColor || "#f4f8ff");
}
function drawPreviewBall(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.85, r * 0.3, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, shade(color, 0.55));
  g.addColorStop(0.65, color);
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(color, -0.72);
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 - 0.3;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.18, 0, TAU); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(10,20,40,.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

/* ---------- field ---------- */
function drawField(ctx, now) {
  const bg = ctx.createLinearGradient(0, 0, WORLD.w, WORLD.h);
  bg.addColorStop(0, "#0a1122");
  bg.addColorStop(1, "#070b17");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  // glow orbs behind pitch
  const o1 = ctx.createRadialGradient(WORLD.w * 0.18, WORLD.h * 0.1, 20, WORLD.w * 0.18, WORLD.h * 0.1, 520);
  o1.addColorStop(0, "rgba(255,61,129,.18)"); o1.addColorStop(1, "rgba(255,61,129,0)");
  ctx.fillStyle = o1; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  const o2 = ctx.createRadialGradient(WORLD.w * 0.85, WORLD.h * 0.92, 20, WORLD.w * 0.85, WORLD.h * 0.92, 520);
  o2.addColorStop(0, "rgba(46,230,197,.16)"); o2.addColorStop(1, "rgba(46,230,197,0)");
  ctx.fillStyle = o2; ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // turf
  const grass = ctx.createLinearGradient(FIELD.x, FIELD.y, FIELD.x, FIELD.y + FIELD.h);
  grass.addColorStop(0, "#0d5c46");
  grass.addColorStop(0.5, "#0a6b4c");
  grass.addColorStop(1, "#084a3a");
  ctx.fillStyle = grass;
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.045)";
    ctx.fillRect(FIELD.x + i * FIELD.w / 10, FIELD.y, FIELD.w / 10, FIELD.h);
  }
  // subtle mow arcs
  ctx.strokeStyle = "rgba(255,255,255,.045)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(CX, CY, 210, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(CX, CY, 320, 0, TAU); ctx.stroke();

  // markings
  ctx.strokeStyle = "rgba(228,255,246,.62)";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.strokeRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  ctx.beginPath(); ctx.moveTo(CX, FIELD.y); ctx.lineTo(CX, FIELD.y + FIELD.h); ctx.stroke();
  ctx.beginPath(); ctx.arc(CX, CY, 105, 0, TAU); ctx.stroke();
  ctx.fillStyle = "rgba(228,255,246,.72)";
  ctx.beginPath(); ctx.arc(CX, CY, 6, 0, TAU); ctx.fill();
  // goal boxes + spots
  const boxH = 380, boxD = 210;
  ctx.strokeRect(FIELD.x, CY - boxH / 2, boxD, boxH);
  ctx.strokeRect(FIELD.x + FIELD.w - boxD, CY - boxH / 2, boxD, boxH);
  ctx.strokeRect(FIELD.x, CY - 150, 90, 300);
  ctx.strokeRect(FIELD.x + FIELD.w - 90, CY - 150, 90, 300);
  ctx.fillStyle = "rgba(228,255,246,.6)";
  ctx.beginPath(); ctx.arc(FIELD.x + 150, CY, 4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(FIELD.x + FIELD.w - 150, CY, 4, 0, TAU); ctx.fill();

  // corner arcs
  [[FIELD.x, FIELD.y, 0], [FIELD.x + FIELD.w, FIELD.y, Math.PI / 2],
   [FIELD.x + FIELD.w, FIELD.y + FIELD.h, Math.PI], [FIELD.x, FIELD.y + FIELD.h, -Math.PI / 2]].forEach(([x, y, a]) => {
    ctx.beginPath(); ctx.arc(x, y, 26, a, a + Math.PI / 2); ctx.stroke();
  });

  // center branding
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 64px 'Trebuchet MS', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SPARKPITCH", CX, CY + 210);
  ctx.restore();

  // outer ad boards
  const boardCols = ["#ff3d81", "#41a8ff", "#ffcf3f", "#2ee6c5", "#a06bff"];
  const boardY = FIELD.y - 24;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = withAlpha(boardCols[i % boardCols.length], 0.55);
    roundRect(ctx, FIELD.x + i * FIELD.w / 16 + 4, boardY, FIELD.w / 16 - 8, 12, 4);
    ctx.fill();
  }
}
function drawGoals(ctx, now) {
  const y0 = GOAL_MOUTH.min, y1 = GOAL_MOUTH.max;
  [0, 1].forEach(side => {
    const x = side === 0 ? FIELD.x - GOAL_DEPTH : FIELD.x + FIELD.w;
    const netGrad = ctx.createLinearGradient(x, y0, x + GOAL_DEPTH, y1);
    netGrad.addColorStop(0, "rgba(4,10,20,.82)");
    netGrad.addColorStop(1, "rgba(10,24,38,.55)");
    ctx.fillStyle = netGrad;
    ctx.fillRect(x, y0, GOAL_DEPTH, y1 - y0);
    ctx.strokeStyle = "rgba(170,220,255,.24)";
    ctx.lineWidth = 1.2;
    for (let gx = x + 8; gx < x + GOAL_DEPTH; gx += 12) {
      ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y1); ctx.stroke();
    }
    for (let gy = y0 + 8; gy < y1; gy += 12) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + GOAL_DEPTH, gy); ctx.stroke();
    }
    // posts
    ctx.strokeStyle = "#eaf6ff";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(120,220,255,.8)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(side === 0 ? FIELD.x : FIELD.x + FIELD.w, y0);
    ctx.lineTo(side === 0 ? FIELD.x - GOAL_DEPTH : FIELD.x + FIELD.w + GOAL_DEPTH, y0);
    ctx.moveTo(side === 0 ? FIELD.x : FIELD.x + FIELD.w, y1);
    ctx.lineTo(side === 0 ? FIELD.x - GOAL_DEPTH : FIELD.x + FIELD.w + GOAL_DEPTH, y1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(234,246,255,.75)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(side === 0 ? FIELD.x - GOAL_DEPTH : FIELD.x + FIELD.w + GOAL_DEPTH, y0);
    ctx.lineTo(side === 0 ? FIELD.x - GOAL_DEPTH : FIELD.x + FIELD.w + GOAL_DEPTH, y1);
    ctx.stroke();
  });
  ctx.lineCap = "butt";
}
function drawBallTrail(ctx) {
  const b = MATCH.ball;
  if (!b) return;
  const speed = Math.hypot(b.vel.x, b.vel.y);
  if (speed < 220 || b.history.length < 3) return;
  for (let i = 0; i < b.history.length; i += 2) {
    const h = b.history[i];
    const a = (i / b.history.length) * 0.32;
    ctx.fillStyle = withAlpha(b.color || "#f4f8ff", a);
    ctx.beginPath(); ctx.arc(h.x, h.y, b.radius * (0.3 + i / b.history.length * 0.5), 0, TAU); ctx.fill();
  }
}
/* Clone Shot decoys: drawn like the ball but translucent, so they look like
   real balls in flight without ever being able to score. */
function drawBallFakes(ctx) {
  if (!MATCH.ballFakes.length) return;
  for (const f of MATCH.ballFakes) {
    ctx.save();
    ctx.globalAlpha = 0.42 + 0.2 * Math.sin(f.life * 9);
    ctx.translate(f.x, f.y);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.ellipse(3, 5, f.radius * 0.95, f.radius * 0.5, 0, 0, TAU); ctx.fill();
    ctx.rotate(f.rot);
    const ballColor = MATCH.ball ? (MATCH.ball.color || "#f4f8ff") : "#f4f8ff";
    const bg = ctx.createRadialGradient(-4, -4, 1, 0, 0, f.radius);
    bg.addColorStop(0, shade(ballColor, 0.65));
    bg.addColorStop(0.7, ballColor);
    bg.addColorStop(1, shade(ballColor, -0.32));
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0, 0, f.radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(199,166,255,.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
function drawBall(ctx, now) {
  const b = MATCH.ball;
  if (!b) return;
  ctx.save();
  if (b.phantom > 0) ctx.globalAlpha = 0.5;
  ctx.translate(b.pos.x, b.pos.y);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath(); ctx.ellipse(3, 5, b.radius * 0.95, b.radius * 0.5, 0, 0, TAU); ctx.fill();
  if (b.rocket > 0 || b.fire > 0) {
    const g = ctx.createRadialGradient(0, 0, b.radius * 0.4, 0, 0, b.radius * 3);
    g.addColorStop(0, "rgba(255,170,60,.8)");
    g.addColorStop(1, "rgba(255,90,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, b.radius * 3, 0, TAU); ctx.fill();
  }
  if (b.frozen > 0) {
    ctx.shadowColor = "#9fe6ff"; ctx.shadowBlur = 22;
  } else if (b.curveTimer > 0) {
    ctx.shadowColor = "#57d6ff"; ctx.shadowBlur = 16;
  } else if (b.electric > 0) {
    ctx.shadowColor = "#c9f0ff"; ctx.shadowBlur = 20;
  } else if (b.phoenix) {
    ctx.shadowColor = "#ff8f3d"; ctx.shadowBlur = 20;
  } else if (b.well) {
    ctx.shadowColor = "#a06bff"; ctx.shadowBlur = 18;
  } else if (b.tornado) {
    ctx.shadowColor = "#9fd0ff"; ctx.shadowBlur = 16;
  }
  ctx.rotate(b.rot);
  const ballColor = b.color || "#f4f8ff";
  const bg = ctx.createRadialGradient(-4, -4, 1, 0, 0, b.radius);
  bg.addColorStop(0, shade(ballColor, 0.65));
  bg.addColorStop(0.7, ballColor);
  bg.addColorStop(1, shade(ballColor, -0.32));
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(20,32,60,.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // classic panels
  ctx.fillStyle = shade(ballColor, -0.78);
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * b.radius * 0.62, Math.sin(a) * b.radius * 0.62, b.radius * 0.2, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, b.radius * 0.28, 0, TAU);
  ctx.fill();
  ctx.rotate(-b.rot);
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.beginPath(); ctx.ellipse(-b.radius * 0.3, -b.radius * 0.35, b.radius * 0.26, b.radius * 0.18, -0.6, 0, TAU); ctx.fill();
  if (b.frozen > 0) {
    ctx.strokeStyle = "rgba(159,230,255,.9)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * b.radius * 1.2, Math.sin(a) * b.radius * 1.2);
      ctx.lineTo(Math.cos(a) * b.radius * 1.8, Math.sin(a) * b.radius * 1.8);
      ctx.stroke();
    }
  }
  ctx.restore();
  /* expansion-set auras, drawn outside the ball rotation */
  if (b.electric > 0) {
    ctx.strokeStyle = "rgba(201,240,255,.9)";
    ctx.lineWidth = 1.6;
    const t = now / 90;
    for (let i = 0; i < 4; i++) {
      const a0 = t + i * TAU / 4;
      ctx.beginPath();
      ctx.moveTo(b.pos.x + Math.cos(a0) * b.radius * 1.3, b.pos.y + Math.sin(a0) * b.radius * 1.3);
      ctx.lineTo(b.pos.x + Math.cos(a0 + 0.5) * b.radius * 1.3, b.pos.y + Math.sin(a0 + 0.5) * b.radius * 1.3);
      ctx.lineTo(b.pos.x + Math.cos(a0 + 0.9) * b.radius * 2, b.pos.y + Math.sin(a0 + 0.9) * b.radius * 2);
      ctx.stroke();
    }
  }
  if (b.tornado) {
    const r = b.radius + 26;
    ctx.strokeStyle = "rgba(159,208,255,.55)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = now / 150 + i * TAU / 3;
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, r, a, a + 1.9);
      ctx.stroke();
    }
  }
  if (b.well) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 200);
    ctx.strokeStyle = "rgba(160,107,255,.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, 90 + pulse * 16, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, 165 + pulse * 22, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (b.shieldBall) {
    ctx.strokeStyle = "rgba(79,179,255,.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius + 7, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(79,179,255,.14)";
    ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius + 7, 0, TAU); ctx.fill();
  }
  if (b.phoenix) {
    ctx.strokeStyle = "rgba(255,143,61,.8)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius + 9, 0, TAU); ctx.stroke();
  }
  if (b.quake) {
    ctx.strokeStyle = "rgba(255,180,107,.75)";
    ctx.lineWidth = 2;
    const qs = 0.6 + 0.4 * Math.sin(now / 130);
    ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius + 6 * qs, 0, TAU); ctx.stroke();
  }
  if (b.boomerang) {
    // the marked return point, plus a faint pull line back to it
    const mx = b.boomerang.ax, my = b.boomerang.ay;
    ctx.strokeStyle = "rgba(123,255,207,.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(mx, my, 16, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "rgba(123,255,207,.28)";
    ctx.beginPath(); ctx.moveTo(b.pos.x, b.pos.y); ctx.lineTo(mx, my); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (b.dribble) {
    // possession ring + feet tether, tinted by the team carrying the ball
    const tint = b.dribble.team === 0 ? "255,138,216" : "46,230,197";
    const pulse = 3 + Math.sin(MATCH.timeLeft * 7) * 1.4;
    ctx.strokeStyle = "rgba(" + tint + ",.85)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius + pulse, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "rgba(" + tint + ",.3)";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(b.pos.x, b.pos.y);
    ctx.lineTo(b.dribble.pos.x, b.dribble.pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (b.stick) {
    ctx.strokeStyle = "rgba(255,138,216,.5)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(b.pos.x, b.pos.y);
    ctx.lineTo(b.stick.pos.x, b.stick.pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ---------- match overlay graphics ---------- */
function drawMiniGoal(ctx, now) {
  const mg = MATCH.miniGoal;
  if (!mg) return;
  ctx.save();
  ctx.translate(mg.x, mg.y);
  const pulse = 0.5 + Math.sin(now / 160) * 0.5;
  ctx.shadowColor = "#ffcf3f";
  ctx.shadowBlur = 18 + pulse * 18;
  ctx.strokeStyle = "rgba(255,207,63," + (mg.used ? 0.2 : 0.9) + ")";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(-mg.w / 2, -mg.h / 2, mg.w, mg.h);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,207,63," + (mg.used ? 0.03 : 0.09) + ")";
  ctx.fillRect(-mg.w / 2, -mg.h / 2, mg.w, mg.h);
  // net lines
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,230,150,.35)";
  ctx.lineWidth = 1;
  for (let x = -mg.w / 2 + 10; x < mg.w / 2; x += 12) {
    ctx.beginPath(); ctx.moveTo(x, -mg.h / 2); ctx.lineTo(x, mg.h / 2); ctx.stroke();
  }
  for (let y = -mg.h / 2 + 10; y < mg.h / 2; y += 12) {
    ctx.beginPath(); ctx.moveTo(-mg.w / 2, y); ctx.lineTo(mg.w / 2, y); ctx.stroke();
  }
  ctx.font = "900 14px 'Trebuchet MS', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,236,170,.95)";
  ctx.fillText(mg.used ? "SCORED" : "BONUS TARGET", 0, 5);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(-mg.w / 2, mg.h / 2 + 8, mg.w, 4);
  ctx.fillStyle = "#ffcf3f";
  ctx.fillRect(-mg.w / 2, mg.h / 2 + 8, mg.w * clamp(mg.life / 10, 0, 1), 4);
  ctx.restore();
}
function drawBarriers(ctx, now) {
  MATCH.barriers.forEach(w => {
    if (w.arena) {
      // permanent pinball bumper
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(now / 420 + (w.x + w.y) / 90);
      ctx.shadowColor = "#63e0ff";
      ctx.shadowBlur = 14 + pulse * 12;
      const g = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
      g.addColorStop(0, "rgba(99,224,255,.30)");
      g.addColorStop(1, "rgba(46,230,197,.24)");
      ctx.fillStyle = g;
      roundRect(ctx, w.x, w.y, w.w, w.h, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(190,245,255," + (0.65 + pulse * 0.3) + ")";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(99,224,255,.35)";
      ctx.lineWidth = 1.5;
      for (let d = 12; d < Math.max(w.w, w.h); d += 18) {
        ctx.beginPath();
        if (w.w >= w.h) { ctx.moveTo(w.x + d, w.y + 3); ctx.lineTo(w.x + d, w.y + w.h - 3); }
        else { ctx.moveTo(w.x + 3, w.y + d); ctx.lineTo(w.x + w.w - 3, w.y + d); }
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.save();
    const a = clamp(w.life / 0.6, 0, 1);
    ctx.globalAlpha = a;
    ctx.shadowColor = w.color; ctx.shadowBlur = 22;
    const grad = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y);
    grad.addColorStop(0, "rgba(255,180,107,.25)");
    grad.addColorStop(0.5, "rgba(255,180,107,.65)");
    grad.addColorStop(1, "rgba(255,180,107,.25)");
    ctx.fillStyle = grad;
    roundRect(ctx, w.x, w.y, w.w, w.h, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,220,180,.8)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -now / 40;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.font = "900 12px 'Trebuchet MS', system-ui";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(w.x + w.w / 2, w.y + w.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("GOAL WALL", 0, 4);
    ctx.restore();
    ctx.restore();
  });
}
function drawMagnetPoints(ctx, now) {
  MATCH.magnetPoints.forEach(mp => {
    ctx.save();
    ctx.translate(mp.x, mp.y);
    ctx.strokeStyle = withAlpha(mp.color, 0.85);
    ctx.lineWidth = 3;
    ctx.shadowColor = mp.color; ctx.shadowBlur = 18;
    for (let i = 0; i < 3; i++) {
      const rr = 18 + i * 16 + (now / 260) % 16;
      ctx.globalAlpha = clamp(1 - rr / 90, 0, 1) * clamp(mp.life / mp.maxLife + 0.2, 0, 1);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = withAlpha(mp.color, 0.9);
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    ctx.restore();
  });
}
function drawClones(ctx, now) {
  MATCH.clones.forEach(c => {
    const a = clamp(c.life / 1.2, 0, 1) * 0.6;
    drawCharacter(ctx, c.x, c.y, PLAYER_R, { look: c.look, face: c.face, facing: { x: 0, y: 1 },
      alpha: a, time: now / 1000, seed: c.x });
    ctx.strokeStyle = "rgba(199,166,255,.7)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(c.x, c.y, PLAYER_R + 9, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(10,16,32,.7)";
    ctx.font = "900 10px 'Trebuchet MS', system-ui";
    ctx.textAlign = "center";
    ctx.fillText("DECOY", c.x, c.y - PLAYER_R - 16);
  });
}
function drawFx(ctx, now) {
  MATCH.fx.forEach(f => {
    const prog = 1 - f.life / f.maxLife;
    const alpha = clamp(f.life / f.maxLife, 0, 1);
    if (f.type === "ring") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = f.width * (0.4 + alpha);
      ctx.shadowColor = f.color; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(f.x, f.y, lerp(f.r0, f.r1, prog), 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === "text") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "900 20px 'Trebuchet MS', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(4,9,20,.75)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    } else if (f.type === "beam") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 6 * alpha;
      ctx.shadowColor = f.color; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.restore();
    } else if (f.type === "dash") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        const ox = -f.dy * i * 7, oy = f.dx * i * 7;
        ctx.beginPath();
        ctx.moveTo(f.x + ox, f.y + oy);
        ctx.lineTo(f.x + ox - f.dx * 56, f.y + oy - f.dy * 56);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
}
function drawParticles(ctx) {
  MATCH.particles.forEach(p => {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    if (p.confetti) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
      ctx.restore();
    } else if (p.bubble) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, TAU); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

function renderMatch(dt) {
  const canvas = $("game-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const scale = canvas.width / WORLD.w;
  if (!scale || !isFinite(scale)) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, WORLD.w, WORLD.h);
  const now = performance.now();
  drawField(ctx, now);
  drawGoals(ctx, now);
  drawMiniGoal(ctx, now);
  drawMagnetPoints(ctx, now);
  drawBarriers(ctx, now);
  drawBallTrail(ctx);
  const teamColors = ["#ff3d81", "#2ee6c5"];
  if (SAVE.settings.screenShake && MATCH.shakeT > 0) {
    const m = MATCH.shakeMag * clamp(MATCH.shakeT / 0.35, 0, 1);
    ctx.translate(Math.sin(now * 0.07) * m, Math.cos(now * 0.11) * m);
  }
  drawShotGuides(ctx, teamColors);
  MATCH.players.forEach(p => {
    if (p.human) {
      // small aim chevron so kicks are predictable
      const ang = Math.atan2(p.facing.y, p.facing.x);
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = teamColors[p.team];
      ctx.beginPath();
      ctx.moveTo(p.radius + 20, 0);
      ctx.lineTo(p.radius + 9, -7);
      ctx.lineTo(p.radius + 9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    drawCharacter(ctx, p.pos.x, p.pos.y, p.radius, {
      look: p.look, face: p.face, facing: p.facing, time: now / 1000, seed: p.id * 1.7,
      teamColor: p.human ? teamColors[p.team] : null,
      label: p.human ? (p.label || "P1") : null,
      buffs: p.buffs, kickAnim: p.kickAnim,
    });
  });
  drawClones(ctx, now);
  drawBallFakes(ctx);
  drawBall(ctx, now);
  if (SAVE.settings.visualFx) {
    drawFx(ctx, now);
    drawParticles(ctx);
  }
}

/* Subtle optional guide: a short dashed line from the ball along the assisted
   shot direction, only while a human is close enough to kick. */
function drawShotGuides(ctx, teamColors) {
  if (!SAVE.settings.aimIndicator) return;
  const b = MATCH.ball;
  if (!b) return;
  MATCH.players.forEach(p => {
    if (!p.human) return;
    const reach = p.radius + b.radius + 52;
    if (dist(p.pos.x, p.pos.y, b.pos.x, b.pos.y) > reach) return;
    const aim = shotAim(p);
    const color = teamColors[p.team] || "#ffffff";
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.moveTo(b.pos.x + aim.x * (b.radius + 6), b.pos.y + aim.y * (b.radius + 6));
    ctx.lineTo(b.pos.x + aim.x * 92, b.pos.y + aim.y * 92);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.pos.x + aim.x * 92, b.pos.y + aim.y * 92, 3.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
}

/* ==========================================================================
   UI WIRING + BOOT
   ========================================================================== */
let confirmCallback = null;
function showConfirm(title, body, onYes) {
  $("confirm-title").textContent = title;
  $("confirm-body").textContent = body;
  confirmCallback = onYes;
  $("confirm-modal").classList.add("show");
}
function syncSetupFromSave() {
  const known = MODES.some(m => m.id === SAVE.lastMode);
  setup.mode = known ? SAVE.lastMode : "1v1ai";
  setup.duration = [60,120,180,300].includes(Number(SAVE.lastDuration)) ? Number(SAVE.lastDuration) : 120;
  setup.target = [0,3,5,7].includes(Number(SAVE.lastTarget)) ? Number(SAVE.lastTarget) : 5;
  setup.difficulty = DIFFICULTY[SAVE.lastDifficulty] ? SAVE.lastDifficulty : "beginner";
  setup.firstGoal = !!SAVE.lastFirstGoal;
  previewCharId = SAVE.chars.selected;
  customPreview = {
    colorId: SAVE.look.colorId || "mint",
    color: SAVE.look.color || "#2ee6c5",
    hat: SAVE.look.hat || "none",
    hatColor: SAVE.look.hatColor || "#ff3d81",
    trail: SAVE.look.trail || "none",
    glow: SAVE.look.glow || "none",
    ballColor: SAVE.look.ballColor || "#f4f8ff",
  };
  customSelected = null;
  abilityTabPlayer = 0;
  bindTabPlayer = 0;
}
function wireUI() {
  $("btn-play").addEventListener("click", () => { Sound.play("click"); showScreen("play"); });
  $("btn-tutorial").addEventListener("click", startTutorial);
  $("btn-tutorial-play").addEventListener("click", startTutorial);
  $("btn-tutorial-skip").addEventListener("click", () => { Sound.play("click"); advanceTutorial(); });
  $("btn-tutorial-exit").addEventListener("click", () => { Sound.play("click"); endTutorial("Left the tutorial."); });
  $("btn-collection").addEventListener("click", () => { Sound.play("click"); previewCharId = SAVE.chars.selected; showScreen("collection"); });
  $("btn-abilities").addEventListener("click", () => { Sound.play("click"); showScreen("abilities"); });
  $("btn-shop").addEventListener("click", () => { Sound.play("click"); showScreen("shop"); });
  $("btn-customize").addEventListener("click", () => {
    Sound.play("click");
    customSelected = null;
    customPreview = {
      colorId: SAVE.look.colorId || "mint", color: SAVE.look.color || "#2ee6c5",
      hat: SAVE.look.hat || "none", hatColor: SAVE.look.hatColor || "#ff3d81",
      trail: SAVE.look.trail || "none", glow: SAVE.look.glow || "none",
      ballColor: SAVE.look.ballColor || "#f4f8ff",
    };
    showScreen("customize");
  });
  $("btn-settings").addEventListener("click", () => { Sound.play("click"); showScreen("settings"); });
  document.querySelectorAll("[data-back]").forEach(btn => {
    btn.addEventListener("click", () => { Sound.play("click"); returnHome(); });
  });
  document.querySelectorAll("[data-abil-player]").forEach(btn => {
    btn.addEventListener("click", () => { abilityTabPlayer = Number(btn.dataset.abilPlayer); Sound.play("click"); renderAbilities(); });
  });
  document.querySelectorAll("[data-bind-player]").forEach(btn => {
    btn.addEventListener("click", () => { bindTabPlayer = Number(btn.dataset.bindPlayer); pendingBind = null; Sound.play("click"); renderSettings(); });
  });
  document.querySelectorAll("[data-custom-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      customTab = btn.dataset.customTab;
      customSelected = null;
      Sound.play("click");
      renderCustomize();
    });
  });
  $("btn-start-match").addEventListener("click", () => {
    const mode = setup.mode;
    const config = {
      mode,
      duration: Number($("opt-duration").value) || 120,
      target: Number($("opt-target").value) || 0,
      difficulty: $("opt-difficulty").value || "beginner",
      firstGoal: $("opt-firstgoal").value === "1",
    };
    startMatch(config);
  });
  ["opt-duration", "opt-target", "opt-difficulty", "opt-firstgoal"].forEach(id => {
    $(id).addEventListener("change", () => {
      if (id === "opt-duration") { setup.duration = Number($(id).value); SAVE.lastDuration = setup.duration; }
      if (id === "opt-target") { setup.target = Number($(id).value); SAVE.lastTarget = setup.target; }
      if (id === "opt-difficulty") { setup.difficulty = $(id).value; SAVE.lastDifficulty = setup.difficulty; }
      if (id === "opt-firstgoal") { setup.firstGoal = $(id).value === "1"; SAVE.lastFirstGoal = setup.firstGoal; }
      persist();
      Sound.play("click");
      renderPlay(); // keep the payout line in step with the chosen rules
    });
  });
  $("btn-char-action").addEventListener("click", () => { Sound.play("click"); buyOrSelectCharacter(); });
  $("btn-abil-shop").addEventListener("click", () => { Sound.play("click"); showScreen("shop"); });
  $("btn-forge").addEventListener("click", forgeAbility);
  $("btn-watch-ad").addEventListener("click", requestRewardedAd);
  $("btn-result-ad").addEventListener("click", requestResultAd);
  $("btn-result-ad").addEventListener("click", requestRewardedAd);
  $("btn-ad-close").addEventListener("click", () => { $("ad-modal").classList.remove("show"); Sound.play("click"); });
  $("btn-pack-collect").addEventListener("click", closePackOverlay);
  $("btn-custom-buy").addEventListener("click", applyCustomSelection);

  // ---- audio settings (independent buses) ----
  $("settings-mute").addEventListener("click", () => {
    SAVE.audio.muted = !SAVE.audio.muted;
    Sound.setMix(SAVE.audio);
    persist();
    renderSettings();
    if (!SAVE.audio.muted) Sound.play("click");
  });
  document.querySelectorAll("[data-vol]").forEach(input => {
    input.addEventListener("input", () => {
      const key = input.dataset.vol;
      const pct = clamp(Number(input.value) || 0, 0, 100);
      SAVE.audio[key] = pct / 100;
      if (key !== "master") SAVE.audio.muted = false;
      if (SAVE.audio.muted && pct > 0) SAVE.audio.muted = false;
      Sound.setMix(SAVE.audio);
      const out = document.querySelector(`[data-vol-val="${key}"]`);
      if (out) out.textContent = String(Math.round(pct));
      persist();
    });
    input.addEventListener("change", () => {
      Sound.resume();
      if (input.dataset.vol === "cheer") Sound.cheer();
      else if (input.dataset.vol === "crowd") Sound.startCrowd();
      else Sound.play("click");
      renderSettings();
    });
  });
  $("btn-test-sound").addEventListener("click", () => {
    Sound.resume();
    Sound.play("kick");
    setTimeout(() => Sound.play("coin"), 220);
    setTimeout(() => Sound.play("ability"), 440);
  });
  $("btn-test-cheer").addEventListener("click", () => { Sound.resume(); Sound.cheer(); });

  // ---- gameplay toggles ----
  document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.toggle;
      SAVE.settings[key] = !SAVE.settings[key];
      btn.setAttribute("aria-pressed", SAVE.settings[key] ? "true" : "false");
      persist();
      Sound.play("click");
    });
  });

  // ---- player names ----
  const commitNames = () => {
    const p1 = cleanName($("name-p1").value, "");
    const p2 = cleanName($("name-p2").value, "");
    if (!p1 || !p2) {
      $("name-note").textContent = "Names cannot be empty. Use up to 16 characters — spaces are tidied automatically.";
      Sound.play("deny");
      return;
    }
    SAVE.names.p1 = p1;
    SAVE.names.p2 = p2;
    persist();
    $("name-p1").value = p1;
    $("name-p2").value = p2;
    $("name-note").textContent = "Saved. Your names now appear above your characters and on the scoreboard.";
    Sound.play("coin");
    toast("Names saved: " + p1 + " and " + p2, "good");
    renderHome();
  };
  $("btn-save-names").addEventListener("click", commitNames);
  $("btn-cancel-names").addEventListener("click", () => {
    $("name-p1").value = SAVE.names.p1;
    $("name-p2").value = SAVE.names.p2;
    $("name-note").textContent = "Changes cancelled. Your saved names are unchanged.";
    Sound.play("click");
  });
  ["name-p1", "name-p2"].forEach(id => {
    $(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitNames(); }
      if (e.key === "Escape") { e.preventDefault(); $("btn-cancel-names").click(); }
    });
  });
  $("btn-reset-save").addEventListener("click", () => {
    showConfirm("Reset all progress?", "Coins, unlocked abilities, cosmetics and stats on this device will be wiped. This cannot be undone.", () => {
      try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
      replaceSave(defaultSave());
      saveBlocked = false;
      applySaveToSettings();
      syncSetupFromSave();
      persist();
      showScreen("home", { force: true });
      toast("Progress reset. Fresh start!", "good");
      Sound.play("whistle");
    });
  });
  $("btn-export-save").addEventListener("click", () => {
    const text = JSON.stringify(SAVE);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast("Save code copied to clipboard.", "good")).catch(() => {
        downloadText("sparkpitch-save.json", text);
        toast("Save file downloaded.", "good");
      });
    } else {
      downloadText("sparkpitch-save.json", text);
      toast("Save file downloaded.", "good");
    }
  });

  // confirm modal
  $("btn-confirm-yes").addEventListener("click", () => {
    $("confirm-modal").classList.remove("show");
    const cb = confirmCallback;
    confirmCallback = null;
    if (cb) cb();
  });
  $("btn-confirm-no").addEventListener("click", () => { $("confirm-modal").classList.remove("show"); confirmCallback = null; Sound.play("click"); });

  // pause menu
  $("btn-pause").addEventListener("click", () => togglePause());
  $("btn-pause-resume").addEventListener("click", () => {
    togglePause(false);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
  $("btn-pause-restart").addEventListener("click", () => {
    $("pause-menu").classList.remove("show");
    startMatch(MATCH.config);
  });
  $("btn-pause-quit").addEventListener("click", () => {
    $("pause-menu").classList.remove("show");
    returnHome();
  });
  // result menu
  $("btn-rematch").addEventListener("click", () => {
    $("result").classList.remove("show");
    CG.midgame(() => { if (MATCH.config) startMatch(MATCH.config); });
  });
  $("btn-result-home").addEventListener("click", () => {
    $("result").classList.remove("show");
    CG.midgame(returnHome);
  });

  // prevent backdrop dismissal of pack overlay while revealing leftovers
  $("pack-overlay").addEventListener("click", (e) => { if (e.target === $("pack-overlay")) return; });
}
function applySaveToSettings() {
  Sound.setMix(SAVE.audio);
}
function boot() {
  document.querySelectorAll("button").forEach(b => { if (!b.getAttribute("type")) b.type = "button"; });
  // A hosting wrapper with a form around the game can never reload the page.
  document.addEventListener("submit", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
  loadSave();
  applySaveToSettings();
  if (!SAVE.starterGranted) {
    SAVE.coins += STARTER_COINS;
    SAVE.starterGranted = true;
    persist();
  }
  if (freshSave) persist();
  CloudSave.start();
  syncSetupFromSave();
  wireUI();
  showScreen("home", { force: true });
  updateAdButton();
  setInterval(updateAdButton, 1000);
  requestAnimationFrame(gameLoop);
  if (saveError) toast(saveError, "bad");
  // A tiny debug surface keeps the game easy to test from the console.
  window.__SP__ = {
    MATCH, ABILITIES, CHARACTERS, PACKS, SAVE, Ads,
    showScreen, startMatch, exitMatch, activateAbility, playerKick, useAbilitySlot,
    togglePause, openPack, requestRewardedAd, forgeAbility, persist, renderShop,
    renderAbilities, renderHome, renderCollection, renderSettings, renderCustomize, updateAdButton, setup, syncSetupFromSave,
    stepMatch, scoreGoal, renderMatch, resizeCanvas, drawAvatarPreview, rollPack,
    maybeAIAbility, decideAIPlan, updateAI, updateMatchHud, updateAbilityHud, buildMatchHud,
    useSignature, activateSignature, shotAim, computeRewards, renderPlaytime, claimPlaytime, accruePlaytime,
    Sound, SIGNATURES, CHARACTERS, returnHome, saveNames: () => $("btn-save-names").click(),
    tick(seconds) { const step = 1 / 120; for (let t = 0; t < seconds; t += step) stepMatch(step); },
  };
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

/* ===================== APPEND POINT ===================== */

