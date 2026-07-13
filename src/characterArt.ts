// War-Torn character art — a data-driven "blob people" set for the battle cards.
// Ported verbatim from design_handoff/character handoff/reference.html (the HEROES /
// ENEMIES / S2F / S2_OPTS / s2() structures). Each character is a stack of
// absolutely-positioned layers inside a 96×104 tile, expressed as plain CSS-decl
// strings (the reference's own format); CharacterBlob renders them into a tile.
//
// Pure and DOM-free so it can be unit-tested. Roster ids here match constants.ts
// (MemberId / EnemyDef.id) exactly — including `spammer` ("Brute") and the plain
// `enemy` / `boss` fallback defs.

const INK = '#3a2d28';
const CREAM = '#fffdf6';

interface Entity {
  id: string;
  c: string; // body fill color
  boss?: boolean;
}

const HEROES: Entity[] = [
  { id: 'ranger', c: '#9ed486' },
  { id: 'tank', c: '#8fc3e8' },
  { id: 'mage', c: '#c7a4f0' },
  { id: 'warlock', c: '#b58ad6' },
  { id: 'berserker', c: '#ff9d7e' },
  { id: 'sentinel', c: '#a9bdd4' },
  { id: 'duelist', c: '#ffa9be' },
  { id: 'skald', c: '#f2c078' },
  { id: 'beastWarden', c: '#c9a06e' },
  { id: 'flagellant', c: '#e8c9a8' },
];

const ENEMIES: Entity[] = [
  { id: 'spammer', c: '#cf8a70', boss: false },
  { id: 'swarm', c: '#c2a86a', boss: false },
  { id: 'stalker', c: '#8fa0b8', boss: false },
  { id: 'gatewarden', c: '#a08fd0', boss: true },
  { id: 'ironmaw', c: '#a8b0b8', boss: false },
  { id: 'needler', c: '#b8c078', boss: false },
  { id: 'hexweaver', c: '#cf8ac2', boss: true },
  { id: 'juggernaut', c: '#c29070', boss: false },
  { id: 'devourer', c: '#b06a80', boss: true },
  { id: 'cleaver', c: '#c76a5a', boss: false },
  { id: 'leech', c: '#d8a0c0', boss: false },
  { id: 'lancer', c: '#7fa8c9', boss: false },
  { id: 'devourling', c: '#c07898', boss: false },
  { id: 'enemy', c: '#b0a89c', boss: false },
  { id: 'boss', c: '#8a8296', boss: true },
];

// Per-character signature-feature layers (bottom→top within the feature block).
type FeatureFn = (c: string) => string[];
const S2F: Record<string, FeatureFn> = {
  ranger: () => [
    `left:8%;top:-2%;width:84%;height:37%;background:${INK};clip-path:polygon(50% 0%,100% 76%,86% 100%,72% 80%,58% 100%,44% 80%,30% 100%,16% 80%,0% 76%);z-index:2;`,
    `left:11%;top:1%;width:78%;height:32%;background:#4e6a3e;clip-path:polygon(50% 0%,100% 76%,86% 100%,72% 80%,58% 100%,44% 80%,30% 100%,16% 80%,0% 76%);z-index:2;`,
    `left:45%;top:7%;width:9px;height:9px;background:#9ed486;border:2px solid ${INK};border-radius:0 100% 40% 100%;transform:rotate(20deg);z-index:3;`,
    `left:7%;top:72%;width:86%;height:8%;background:#6a4a32;border:2.5px solid ${INK};border-radius:4px;transform:rotate(-10deg);z-index:2;`,
    `left:44%;top:70%;width:9px;height:9px;background:#d8b878;border:2px solid ${INK};border-radius:2px;transform:rotate(-10deg);z-index:3;`,
  ],
  tank: () => [
    `left:9%;top:5%;width:82%;height:26%;background:#4a6a8a;border:3px solid ${INK};border-radius:999px 999px 6px 6px;z-index:2;`,
    `left:21%;top:16%;width:5px;height:5px;background:#c9d8e8;border-radius:50%;box-shadow:15px 3px 0 #c9d8e8,30px 4px 0 #c9d8e8,45px 3px 0 #c9d8e8;z-index:3;`,
    `left:46%;top:28%;width:8%;height:11%;background:#4a6a8a;border:2.5px solid ${INK};border-radius:0 0 4px 4px;z-index:2;`,
    `left:68%;top:58%;width:3px;height:11px;background:rgba(58,45,40,.5);transform:rotate(20deg);z-index:2;`,
    `left:71%;top:67%;width:3px;height:9px;background:rgba(58,45,40,.5);transform:rotate(-16deg);z-index:2;`,
  ],
  mage: () => [
    `left:18%;top:-8%;width:64%;height:34%;background:#5a3f8a;clip-path:polygon(60% 0%,100% 100%,0% 100%);z-index:2;`,
    `left:42%;top:-13%;width:24%;height:13%;background:#5a3f8a;border-radius:60% 60% 0 60%;transform:rotate(-34deg);z-index:2;`,
    `left:9%;top:22%;width:82%;height:9%;background:#472f70;border-radius:999px;z-index:3;`,
    `left:33%;top:8%;width:10px;height:10px;background:#ffd97a;border:2px dashed ${INK};transform:rotate(14deg);z-index:3;`,
  ],
  warlock: () => [
    `left:7%;top:6%;width:19%;height:19%;background:#3a2453;clip-path:polygon(15% 25%,75% 0%,100% 100%,0% 100%);z-index:2;`,
    `left:12%;top:9%;width:8px;height:3px;background:${CREAM};transform:rotate(-20deg);z-index:3;opacity:.7;`,
    `right:6%;top:-4%;width:21%;height:29%;background:#3a2453;clip-path:polygon(78% 0%,100% 100%,0% 100%);z-index:2;`,
    `left:14%;top:80%;width:72%;height:11%;background:#3a2453;clip-path:polygon(0% 100%,10% 0%,20% 100%,35% 0%,50% 100%,65% 0%,80% 100%,90% 0%,100% 100%);z-index:2;`,
  ],
  berserker: () => [
    `left:58%;top:20%;width:14px;height:50px;background:#8f3d2e;clip-path:polygon(25% 0%,75% 0%,50% 18%,100% 22%,45% 46%,90% 50%,35% 74%,80% 78%,45% 100%,10% 98%,45% 76%,0% 72%,55% 48%,10% 44%,60% 20%,20% 16%);transform:rotate(8deg);z-index:6;`,
    `left:56%;top:28%;width:16px;height:3px;background:${INK};border-radius:2px;transform:rotate(-62deg);z-index:7;`,
    `left:59%;top:42%;width:16px;height:3px;background:${INK};border-radius:2px;transform:rotate(-70deg);z-index:7;`,
    `left:62%;top:56%;width:16px;height:3px;background:${INK};border-radius:2px;transform:rotate(-58deg);z-index:7;`,
  ],
  sentinel: () => [
    `left:30%;top:2%;width:40%;height:12%;background:#5a6f85;border:2.5px solid ${INK};border-radius:999px 999px 0 0;z-index:2;`,
    `left:13%;top:58%;width:74%;height:22%;background:#5a6f85;border:3px solid ${INK};border-radius:7px;z-index:2;`,
    `left:45%;top:64%;width:9px;height:9px;background:#c9d8e8;border:2px solid ${INK};border-radius:50%;z-index:3;`,
    `left:18%;top:62%;width:12px;height:4px;background:rgba(255,255,255,.5);border-radius:2px;transform:rotate(-8deg);z-index:3;`,
  ],
  duelist: () => [
    `left:70%;top:22%;width:30px;height:4px;background:#e0e5ec;border:2px solid ${INK};border-radius:2px;transform:rotate(-34deg);z-index:2;`,
    `left:68%;top:30%;width:10px;height:10px;background:#ffd97a;border:2px solid ${INK};border-radius:50%;z-index:3;`,
    `left:13%;top:58%;width:15px;height:6px;background:#e8d9b8;border:2px solid ${INK};border-radius:2px;transform:rotate(38deg);z-index:3;`,
    `left:13%;top:58%;width:15px;height:6px;background:#e8d9b8;border:2px solid ${INK};border-radius:2px;transform:rotate(-38deg);z-index:3;`,
  ],
  spammer: () => [
    `left:33%;top:63%;width:12px;height:12px;background:${CREAM};border:2px solid ${INK};clip-path:polygon(0 0,100% 0,50% 100%);z-index:4;`,
    `right:33%;top:63%;width:12px;height:12px;background:${CREAM};border:2px solid ${INK};clip-path:polygon(0 0,100% 0,50% 100%);z-index:4;`,
    `left:18%;top:17%;width:17px;height:13px;background:color-mix(in srgb,#cf8a70 55%,${INK});border:2px dashed ${INK};border-radius:3px;transform:rotate(-12deg);z-index:2;`,
    `left:60%;top:56%;width:3px;height:14px;background:rgba(58,45,40,.4);transform:rotate(16deg);box-shadow:7px 2px 0 rgba(58,45,40,.4),14px 4px 0 rgba(58,45,40,.4);z-index:2;`,
  ],
  swarm: () => [
    `left:-13%;top:46%;width:31%;height:33%;background:#c2a86a;border:3px solid ${INK};border-radius:50% 50% 45% 55%/60% 60% 40% 40%;z-index:2;`,
    `left:-6%;top:57%;width:5px;height:6px;background:${INK};border-radius:50%;box-shadow:9px 0 0 ${INK};z-index:3;`,
    `right:-13%;top:51%;width:27%;height:29%;background:#c2a86a;border:3px solid ${INK};border-radius:50% 50% 55% 45%/58% 58% 42% 42%;z-index:2;`,
    `right:-5%;top:60%;width:4px;height:5px;background:${INK};border-radius:50%;box-shadow:-8px 0 0 ${INK};z-index:3;`,
  ],
  stalker: () => [
    `left:5%;top:36%;width:90%;height:23%;background:#3f3a48;border:3px solid ${INK};border-radius:9px;z-index:2;`,
    `left:22%;top:43%;width:14px;height:6px;background:#eafcff;border-radius:3px;box-shadow:0 0 7px rgba(200,240,255,.9);z-index:4;`,
    `right:22%;top:43%;width:14px;height:6px;background:#eafcff;border-radius:3px;box-shadow:0 0 7px rgba(200,240,255,.9);z-index:4;`,
    `right:12%;top:38%;width:3px;height:17px;background:rgba(255,253,246,.35);border-radius:2px;transform:rotate(16deg);box-shadow:7px 1px 0 rgba(255,253,246,.35),14px 2px 0 rgba(255,253,246,.35);z-index:3;`,
  ],
  gatewarden: () => [
    `left:50%;top:-2px;transform:translateX(-50%);width:48px;height:18px;background:#f0a832;border:2.5px solid ${INK};clip-path:polygon(0% 100%,0% 20%,20% 68%,34% 0%,50% 62%,66% 0%,80% 68%,100% 20%,100% 100%);z-index:4;`,
    `left:50%;top:7px;transform:translateX(-50%);width:6px;height:6px;background:#e05a4e;border-radius:50%;z-index:5;`,
    `left:35%;top:56%;width:30%;height:26%;background:#f0d998;border:2.5px solid ${INK};border-radius:6px;z-index:2;`,
    `left:45%;top:60%;width:10px;height:10px;background:${INK};border-radius:50%;z-index:3;`,
    `left:48%;top:68%;width:4px;height:9px;background:${INK};border-radius:0 0 2px 2px;z-index:3;`,
  ],
  ironmaw: () => [
    `left:7%;top:63%;width:86%;height:26%;background:#7a828c;border:3px solid ${INK};border-radius:7px 7px 42% 42%;z-index:2;`,
    `left:13%;top:63%;width:74%;height:10px;background:${CREAM};clip-path:polygon(0% 0%,100% 0%,90% 100%,80% 0%,70% 100%,60% 0%,50% 100%,40% 0%,30% 100%,20% 0%,10% 100%);z-index:3;`,
    `left:22%;top:78%;width:4px;height:4px;background:#c9d8e8;border-radius:50%;box-shadow:12px 1px 0 #c9d8e8,24px 2px 0 #c9d8e8,36px 1px 0 #c9d8e8,48px 0 0 #c9d8e8;z-index:3;`,
  ],
  needler: () => [
    `left:10%;top:-11%;width:80%;height:28%;background:${INK};clip-path:polygon(0% 100%,10% 0%,22% 100%,36% 6%,50% 100%,64% 6%,78% 100%,90% 0%,100% 100%);z-index:2;`,
    `left:13%;top:-8%;width:74%;height:25%;background:#8a9048;clip-path:polygon(0% 100%,10% 0%,22% 100%,36% 6%,50% 100%,64% 6%,78% 100%,90% 0%,100% 100%);z-index:2;`,
    `left:-7%;top:44%;width:14px;height:5px;background:#8a9048;border:2px solid ${INK};border-radius:3px;transform:rotate(24deg);z-index:2;`,
    `right:-7%;top:44%;width:14px;height:5px;background:#8a9048;border:2px solid ${INK};border-radius:3px;transform:rotate(-24deg);z-index:2;`,
  ],
  hexweaver: () => [
    `left:19%;top:-14%;width:62%;height:32%;background:#5a2a52;clip-path:polygon(46% 0%,98% 100%,2% 100%);z-index:2;`,
    `left:5%;top:12%;width:90%;height:10%;background:#472046;border:2.5px solid ${INK};border-radius:999px;z-index:3;`,
    `left:37%;top:4%;width:26%;height:5px;background:#cf8ac2;z-index:3;`,
    `left:46%;top:-12%;width:11px;height:11px;background:radial-gradient(circle at 68% 30%,transparent 52%,#ffd97a 53%);border-radius:50%;z-index:4;`,
    `left:36%;top:66%;width:28%;height:3px;background:${INK};border-radius:2px;z-index:4;`,
    `left:41%;top:62%;width:3px;height:10px;background:${INK};border-radius:2px;box-shadow:9px 0 0 ${INK},18px 0 0 ${INK};z-index:4;`,
  ],
  juggernaut: () => [
    `left:7%;top:3%;width:86%;height:31%;background:#6a4a32;border:3px solid ${INK};border-radius:999px 999px 8px 8px;z-index:2;`,
    `left:20%;top:22%;width:60%;height:6px;background:${INK};border-radius:3px;z-index:3;`,
    `left:1%;top:12%;width:9px;height:9px;background:#d8b878;border:2px solid ${INK};border-radius:50%;z-index:3;`,
    `right:1%;top:12%;width:9px;height:9px;background:#d8b878;border:2px solid ${INK};border-radius:50%;z-index:3;`,
    `left:8%;top:60%;width:84%;height:9%;background:color-mix(in srgb,#c29070 45%,#3a2a1a);border:2.5px solid ${INK};border-radius:4px;z-index:2;`,
    `left:46%;top:60%;width:8px;height:8px;background:#d8b878;border:2px solid ${INK};border-radius:50%;z-index:3;`,
  ],
  devourer: () => [
    `left:50%;top:-2px;transform:translateX(-50%);width:48px;height:18px;background:#f0a832;border:2.5px solid ${INK};clip-path:polygon(0% 100%,0% 20%,20% 68%,34% 0%,50% 62%,66% 0%,80% 68%,100% 20%,100% 100%);z-index:4;`,
    `left:50%;top:7px;transform:translateX(-50%);width:6px;height:6px;background:#e05a4e;border-radius:50%;z-index:5;`,
    `left:15%;top:55%;width:70%;height:32%;background:#3a1018;border:3px solid ${INK};border-radius:9px 9px 48% 48%;z-index:2;`,
    `left:39%;top:70%;width:22%;height:9%;background:#c05a6a;border-radius:50% 50% 50% 50%/40% 40% 60% 60%;z-index:3;`,
    `left:20%;top:55%;width:60%;height:11px;background:${CREAM};clip-path:polygon(0% 0%,100% 0%,88% 100%,76% 0%,62% 100%,50% 0%,38% 100%,24% 0%,12% 100%);z-index:3;`,
    `left:26%;top:78%;width:48%;height:9px;background:${CREAM};clip-path:polygon(0% 100%,12% 0%,24% 100%,38% 0%,50% 100%,62% 0%,76% 100%,88% 0%,100% 100%);z-index:3;`,
  ],
  skald: () => [
    `left:16%;top:3%;width:64%;height:15%;background:#8f5a3e;border:2.5px solid ${INK};border-radius:999px 999px 4px 4px;z-index:2;`,
    `left:10%;top:14%;width:76%;height:6px;background:#6a4326;border:2px solid ${INK};border-radius:999px;z-index:3;`,
    `left:66%;top:-9%;width:9px;height:20px;background:#e05a4e;border:2px solid ${INK};border-radius:50% 50% 50% 50%/85% 85% 15% 15%;transform:rotate(26deg);z-index:2;`,
    `right:-6%;top:56%;width:24px;height:19px;background:#a86a3e;border:2.5px solid ${INK};border-radius:50% 50% 46% 46%;transform:rotate(-24deg);z-index:2;`,
    `right:2%;top:63%;width:6px;height:6px;background:${INK};border-radius:50%;z-index:3;`,
    `right:14%;top:48%;width:17px;height:4px;background:#6a4326;border:2px solid ${INK};border-radius:2px;transform:rotate(-40deg);z-index:2;`,
    `right:8%;top:52%;width:8px;height:8px;background:transparent;border-top:2px solid ${CREAM};border-radius:50%;transform:rotate(30deg);z-index:3;`,
  ],
  beastWarden: () => [
    `left:10%;top:1%;width:80%;height:22%;background:#8a6a44;border:3px solid ${INK};border-radius:999px 999px 10px 10px;z-index:2;`,
    `left:18%;top:16%;width:64%;height:0;border-top:2px dashed rgba(255,253,246,.4);z-index:3;`,
    `left:6%;top:-7%;width:14px;height:14px;background:#8a6a44;border:2.5px solid ${INK};border-radius:50%;z-index:2;`,
    `right:6%;top:-7%;width:14px;height:14px;background:#8a6a44;border:2.5px solid ${INK};border-radius:50%;z-index:2;`,
    `left:36%;top:70%;width:8px;height:10px;background:${CREAM};border:2px solid ${INK};border-radius:50% 50% 50% 0;transform:rotate(-16deg);z-index:3;`,
    `right:36%;top:70%;width:8px;height:10px;background:${CREAM};border:2px solid ${INK};border-radius:50% 50% 0 50%;transform:rotate(16deg);z-index:3;`,
    `left:-20%;top:66%;width:23px;height:16px;background:#9a7250;border:2.5px solid ${INK};border-radius:45% 55% 40% 40%;z-index:2;`,
    `left:-22%;top:72%;width:6px;height:5px;background:#6a4a32;border:2px solid ${INK};border-radius:50%;z-index:3;`,
    `left:-14%;top:70%;width:3px;height:3px;background:${INK};border-radius:50%;z-index:3;`,
  ],
  flagellant: () => [
    `left:8%;top:20%;width:84%;height:11%;background:#e8dcc0;border:2px solid ${INK};transform:rotate(-6deg);z-index:2;`,
    `left:14%;top:24%;width:70%;height:0;border-top:2px dashed rgba(58,45,40,.4);transform:rotate(-6deg);z-index:3;`,
    `right:0%;top:26%;width:10px;height:14px;background:#e8dcc0;border:2px solid ${INK};border-radius:2px;transform:rotate(20deg);z-index:2;`,
    `left:6%;top:58%;width:88%;height:10%;background:#e8dcc0;border:2px solid ${INK};transform:rotate(8deg);z-index:2;`,
    `left:22%;top:76%;width:12px;height:3px;background:#c0453a;border-radius:2px;transform:rotate(-20deg);z-index:3;`,
    `left:60%;top:78%;width:12px;height:3px;background:#c0453a;border-radius:2px;transform:rotate(-20deg);z-index:3;`,
    `left:-6%;top:34%;width:7px;height:7px;background:#8a6a44;border:2px solid ${INK};border-radius:50%;box-shadow:-3px 10px 0 #8a6a44,-5px 20px 0 #8a6a44;z-index:2;`,
  ],
  cleaver: () => [
    `left:55%;top:-13%;width:33px;height:23px;background:${INK};border-radius:2px 10px 2px 2px;transform:rotate(-18deg);clip-path:polygon(0 0,100% 0,100% 76%,84% 100%,68% 76%,52% 100%,0 76%);z-index:2;`,
    `left:57%;top:-11%;width:29px;height:19px;background:#c9d0d8;border-radius:2px 8px 2px 2px;transform:rotate(-18deg);clip-path:polygon(0 0,100% 0,100% 76%,84% 100%,68% 76%,52% 100%,0 76%);z-index:2;`,
    `left:44%;top:5%;width:14px;height:5px;background:#6a4326;border:2px solid ${INK};border-radius:2px;transform:rotate(-18deg);z-index:2;`,
    `left:30%;top:22%;width:3px;height:9px;background:rgba(58,45,40,.5);transform:rotate(12deg);z-index:5;`,
  ],
  leech: () => [
    `left:33%;top:56%;width:34%;height:28%;background:#7a3a52;border:3px solid ${INK};border-radius:50%;z-index:3;`,
    `left:39%;top:62%;width:22%;height:16%;background:transparent;border:3px dotted ${CREAM};border-radius:50%;z-index:4;`,
    `left:45%;top:67%;width:10%;height:8%;background:${INK};border-radius:50%;z-index:4;`,
    `left:34%;top:83%;width:6px;height:9px;background:#c887ab;border-radius:50% 50% 60% 60%;z-index:3;`,
    `left:24%;top:88%;width:52%;height:7px;background:#c887ab;border:2px solid ${INK};border-radius:50%;z-index:0;`,
  ],
  lancer: () => [
    `left:58%;top:-14%;width:5px;height:46px;background:#c9d0d8;border:2px solid ${INK};border-radius:2px;transform:rotate(38deg);z-index:2;`,
    `left:76%;top:-17%;width:10px;height:12px;background:#c9d0d8;border:2px solid ${INK};clip-path:polygon(50% 0,100% 100%,0 100%);transform:rotate(38deg);z-index:2;`,
    `left:64%;top:-4%;width:14px;height:8px;background:#e05a4e;border:2px solid ${INK};clip-path:polygon(0 0,100% 30%,0 100%);transform:rotate(8deg);z-index:2;`,
    `left:14%;top:4%;width:72%;height:20%;background:#5a7a99;border:3px solid ${INK};border-radius:999px 999px 4px 4px;z-index:2;`,
    `left:40%;top:-10%;width:10px;height:13px;background:#e05a4e;border:2px solid ${INK};border-radius:50% 50% 20% 20%;z-index:2;`,
    `left:47%;top:22%;width:7%;height:11%;background:#5a7a99;border:2.5px solid ${INK};border-radius:0 0 3px 3px;z-index:2;`,
  ],
  devourling: () => [
    `left:24%;top:4%;width:9px;height:9px;background:#8a4a62;border:2px solid ${INK};border-radius:50% 50% 20% 20%;transform:rotate(-10deg);z-index:2;`,
    `right:24%;top:4%;width:9px;height:9px;background:#8a4a62;border:2px solid ${INK};border-radius:50% 50% 20% 20%;transform:rotate(10deg);z-index:2;`,
    `left:22%;top:56%;width:56%;height:26%;background:#3a1018;border:3px solid ${INK};border-radius:8px 8px 46% 46%;z-index:2;`,
    `left:26%;top:56%;width:48%;height:8px;background:${CREAM};clip-path:polygon(0 0,100% 0,86% 100%,72% 0,58% 100%,44% 0,30% 100%,16% 0);z-index:3;`,
    `left:40%;top:70%;width:18%;height:8%;background:#c05a6a;border:2px solid ${INK};border-radius:50%;z-index:3;`,
  ],
  enemy: () => [
    `left:24%;top:20%;width:3px;height:12px;background:rgba(58,45,40,.4);transform:rotate(18deg);z-index:2;`,
    `right:20%;top:60%;width:3px;height:10px;background:rgba(58,45,40,.4);transform:rotate(-24deg);z-index:2;`,
  ],
  boss: () => [
    `left:50%;top:-2px;transform:translateX(-50%);width:48px;height:18px;background:#8a929c;border:2.5px solid ${INK};clip-path:polygon(0% 100%,0% 20%,20% 68%,34% 0%,50% 62%,66% 0%,80% 68%,100% 20%,100% 100%);z-index:4;`,
    `left:44%;top:30%;width:3px;height:12px;background:rgba(58,45,40,.4);transform:rotate(14deg);z-index:2;`,
  ],
};

interface FaceOpts {
  rightEye?: 'squint';
  eyes?: 'custom';
  mouth?: 'none';
  brows?: 'none';
}
const S2_OPTS: Record<string, FaceOpts> = {
  berserker: { rightEye: 'squint' },
  stalker: { eyes: 'custom' },
  juggernaut: { brows: 'none' },
  spammer: { mouth: 'none' },
  gatewarden: { mouth: 'none' },
  ironmaw: { mouth: 'none' },
  hexweaver: { mouth: 'none' },
  devourer: { mouth: 'none' },
  leech: { mouth: 'none' },
  devourling: { mouth: 'none' },
};

// Assemble the full bottom→top layer list for one character.
function s2(e: Entity, isEnemy: boolean): string[] {
  const c = e.c;
  const o = S2_OPTS[e.id] || {};
  const shape = isEnemy ? '40% 40% 32% 32% / 44% 44% 30% 30%' : '42% 42% 36% 36% / 48% 48% 34% 34%';
  const p: string[] = [
    `left:16%;right:16%;bottom:0;height:9px;background:rgba(58,45,40,.16);border-radius:50%;z-index:0;`,
    `left:6%;right:6%;top:13%;bottom:9%;background:${c};border:4px solid ${INK};border-radius:${shape};box-shadow:inset 0 -12px 0 rgba(58,45,40,.14),inset 0 4px 0 rgba(255,255,255,.3);z-index:1;`,
  ];
  if (o.brows !== 'none') {
    const deg = isEnemy ? 24 : 7;
    const bt = isEnemy ? '30%' : '33%';
    p.push(`left:18%;top:${bt};width:19%;height:5px;background:${INK};border-radius:3px;transform:rotate(${deg}deg);z-index:5;`);
    p.push(`right:18%;top:${bt};width:19%;height:5px;background:${INK};border-radius:3px;transform:rotate(-${deg}deg);z-index:5;`);
  }
  if (o.eyes !== 'custom') {
    p.push(`left:20%;top:42%;width:16px;height:14px;background:${CREAM};border:2.5px solid ${INK};border-radius:50%;z-index:3;`);
    p.push(`left:27%;top:47%;width:6px;height:7px;background:${INK};border-radius:50%;z-index:4;`);
    if (o.rightEye === 'squint') {
      p.push(`right:20%;top:45%;width:16px;height:9px;background:${CREAM};border:2.5px solid ${INK};border-radius:50%;z-index:3;`);
      p.push(`right:27%;top:47%;width:6px;height:5px;background:${INK};border-radius:50%;z-index:4;`);
    } else {
      p.push(`right:20%;top:42%;width:16px;height:14px;background:${CREAM};border:2.5px solid ${INK};border-radius:50%;z-index:3;`);
      p.push(`right:27%;top:47%;width:6px;height:7px;background:${INK};border-radius:50%;z-index:4;`);
    }
  }
  if (o.mouth !== 'none') {
    if (isEnemy) p.push(`left:39%;top:65%;width:22%;height:8px;background:linear-gradient(90deg,${CREAM} 44%,${INK} 44%,${INK} 56%,${CREAM} 56%);border:2px solid ${INK};border-radius:3px;z-index:4;`);
    else p.push(`left:43%;top:66%;width:14%;height:4px;background:${INK};border-radius:0 0 6px 6px;z-index:4;`);
  }
  const f = S2F[e.id];
  if (f) p.push(...f(c));
  return p;
}

const HERO_BY_ID = new Map(HEROES.map((e) => [e.id, e]));
const ENEMY_BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

export interface CharacterArt {
  layers: string[]; // CSS-decl strings; each is one absolutely-positioned tile layer
  isEnemy: boolean;
}

// Resolve the art for a roster id. `isEnemy` disambiguates when known (member card
// vs enemy panel); it also picks the correct table for the fallback. An unknown id
// resolves to the plain `enemy` art so a future roster addition never crashes.
export function resolveArt(id: string, isEnemy?: boolean): CharacterArt {
  if (isEnemy === true) {
    const e = ENEMY_BY_ID.get(id) ?? ENEMY_BY_ID.get('enemy')!;
    return { layers: s2(e, true), isEnemy: true };
  }
  if (isEnemy === false) {
    const e = HERO_BY_ID.get(id);
    if (e) return { layers: s2(e, false), isEnemy: false };
    // A member id with no hero art: fall back to the plain enemy blob rather than crash.
    return { layers: s2(ENEMY_BY_ID.get('enemy')!, true), isEnemy: true };
  }
  const hero = HERO_BY_ID.get(id);
  if (hero) return { layers: s2(hero, false), isEnemy: false };
  const enemy = ENEMY_BY_ID.get(id) ?? ENEMY_BY_ID.get('enemy')!;
  return { layers: s2(enemy, true), isEnemy: true };
}

// All ids that ship signature art — used by the coverage test.
export const HERO_ART_IDS: readonly string[] = HEROES.map((e) => e.id);
export const ENEMY_ART_IDS: readonly string[] = ENEMIES.map((e) => e.id);
