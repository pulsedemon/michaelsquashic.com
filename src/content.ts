import { must } from "./must";

export const intro = {
  name: "Michael Squashic",
  body: "Senior full-stack engineer in Philadelphia. Twenty years of building for the web: agency work at HUGE, UX prototyping at Google, API platforms at Zipari and React at Chatham Financial. On the side I build games and AI tools.",
};

export type Project = {
  id: string;
  title: string;
  stack: string[];
  /** where the project can be seen live, if anywhere. */
  href?: string;
  /** the project's public source repository, if it has one. */
  source?: string;
  role: string;
  years: string;
  sections: { heading: string; paragraphs: string[] }[];
  images?: Screenshot[];
  /** a loop's four steps in order, drawn as the record's face in place of a picture. */
  cycle?: [string, string, string, string];
};

/** a screenshot and its file's pixel size. */
export type Screenshot = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** the widths of its smaller copies, when not the `COPY_WIDTHS` narrower than the file: a lossless screenshot's 2048 px copy would outweigh the file itself. */
  copies?: number[];
};

export const projects: Project[] = [
  {
    id: "witch",
    title: "Witch",
    stack: ["TypeScript", "Node", "React", "Ink"],
    source: "https://github.com/pulsedemon/witch",
    role: "Sole author",
    years: "2026",
    images: [
      {
        src: "/work/witch/turn.webp",
        width: 4320,
        height: 2610,
        copies: [1440, 2880],
        alt: "Witch after a Codex turn, scrolled back to its edit: the agent's report on plan reviews by a Codex model and a Claude model, above a colored diff of tide.js and the command that checked it. A tools window lists the latest three tool calls, and the status line shows the model, context use and branch. The sidebar shows Codex and Claude usage.",
      },
      {
        src: "/work/witch/commands.webp",
        width: 2880,
        height: 1740,
        copies: [1440],
        alt: "Witch's command palette: new and saved conversations, other sessions in the repository, task claims, model choice, delegated work, shared memory and runtime updates.",
      },
    ],
    sections: [
      {
        heading: "The problem",
        paragraphs: [
          "I use two AI coding agents, each with its own terminal app, history and usage limits. I wanted one interface for both, notes every conversation can share, several sessions on one repository that don't take the same task, and work that continues on the other agent when one runs out of usage. All of it had to keep each agent's own prompts, permissions, settings and logins intact.",
        ],
      },
      {
        heading: "What I built",
        paragraphs: [
          "A full-screen terminal interface with a scrolling conversation, a text box that grows as you type, a status line and a sidebar. It shows file changes as colored diffs, renders images in the terminal and supports clickable links. Behind it, a coordinator owns each conversation and each turn, and every Git operation on the shared notes. Adapters drive the Codex and Claude Code installed on the machine through each vendor's own interfaces, some of them experimental. Sessions coordinate through task claims, questions to each other, pauses and routing of delegated work between the two agents. Witch also follows up on pull requests. On a claimed pull request for the session's checked-out branch, it starts agent turns to resolve merge conflicts, repair failed checks and work through Copilot's review comments. After the pull request merges, Witch attempts to clean up the checkout when the conversation is idle and the branch is still at the merged commit.",
        ],
      },
      {
        heading: "How it works",
        paragraphs: [
          "Codex runs through its app-server over stdio and Claude Code through the Claude Agent SDK. Each agent's own data types stay inside its adapter.",
          "The shared notes live in their own Git repository. Each conversation edits its own branch, and finished changes are published by rebasing onto main. Lines in the shared index merge instead of conflicting, and changes from a turn that was interrupted or failed wait for the user to accept or discard them.",
          "Witch instructs each agent to hand work to another only through it. Unless a model is named, it then picks the agent and model from my delegation settings and each account's remaining usage, and it shows the choice and its reason in the conversation. It also instructs an agent to have a plan it writes reviewed this way before presenting it, and a /review command runs rounds of reviewers over files, with a correction turn after each round that reports findings.",
          "I recorded real sessions with each agent, and the tests replay them through the production adapters without logging in or spending usage. Outgoing Codex requests are checked against Codex's own schema, and a manifest records the exact versions tested.",
          "When an agent reports that its usage is exhausted during a turn I started, Witch continues the conversation on the other agent if that one has capacity and a comparable model. Error text or an ordinary rate limit alone does not trigger a switch.",
          "Witch updates the agents' own command-line tools only when I confirm. It installs the exact version and checks it, including resuming a conversation the previous version started. If the new version fails those checks, Witch tries to put the old one back and checks that it starts, and a failed recovery leaves that installation blocked.",
        ],
      },
      {
        heading: "Where it stands",
        paragraphs: [
          "Open source under the MIT license since November 2026, published as is with no promise of support. Version 0.1.0, built for my own work on macOS, and as far as I know I am its only user. It has automated many tasks I used to run by hand, and it lets me work with Claude Code and Codex at the same time. The repository has 230 test files, and every pull request and every push to main runs type checks, lint, tests and a build on Linux.",
        ],
      },
    ],
  },
  {
    id: "thisisnotavirus",
    title: "thisisnotavirus.com",
    stack: ["TypeScript", "Vite", "Three.js", "Rapier"],
    href: "https://thisisnotavirus.com",
    source: "https://github.com/pulsedemon/thisisnotavirus",
    role: "Sole author",
    years: "2012 to now",
    images: [
      {
        src: "/work/thisisnotavirus/lab.webp",
        width: 4320,
        height: 2610,
        alt: "The Lab blending two viruses, a pink and black spiral and a field of cubes, with the primary and secondary virus pickers and the mix ratio slider.",
      },
      {
        src: "/work/thisisnotavirus/gallery.webp",
        width: 2880,
        height: 1740,
        alt: "The virus gallery: a searchable grid of thumbnails for every virus, from random shapes to the crane game.",
      },
      {
        src: "/work/thisisnotavirus/shell-game.webp",
        width: 2880,
        height: 1740,
        alt: "The shell game in amber line art on black: the eye in the pyramid from the dollar bill fires a red laser at one of the mushroom caps on a gridded board while another bursts in a white flash, a hand reaches in from the right, and ticker lines, coins and small watching eyes fill the dark behind.",
      },
      {
        src: "/work/thisisnotavirus/doors.webp",
        width: 2880,
        height: 1740,
        alt: "Doors: columns of cyan, blue and violet bars of different heights closing in from the top and bottom of the screen on a bright cyan band across the middle.",
      },
      {
        src: "/work/thisisnotavirus/crane-game.webp",
        width: 2880,
        height: 1740,
        alt: "The crane game: a pink and yellow claw machine with a Japanese sign, a pile of plush figures and a prize chute, with the controls and a credits counter at the top.",
      },
      {
        src: "/work/thisisnotavirus/sky.webp",
        width: 2880,
        height: 1740,
        alt: "The sky timelapse: pixelated clouds in bands of green over two shades of blue, each cloud edged in pink.",
      },
      {
        src: "/work/thisisnotavirus/the-room-remembers.webp",
        width: 2880,
        height: 1740,
        alt: "The room remembers: black and white line drawings of a room with a tiled floor, repeating down a corridor into the distance, split by a black band.",
      },
    ],
    sections: [
      {
        heading: "The problem",
        paragraphs: [
          "I wanted one place to publish the small animation experiments I build in my spare time. Each one had to run on its own, and the site had to load quickly in any modern browser.",
          "It started in September 2012 as a single page with one jQuery animation and has been rebuilt in place since. The animations moved into iframes in 2021, the code moved to TypeScript in 2023, and the build moved from webpack to Vite in 2025.",
        ],
      },
      {
        heading: "What I built",
        paragraphs: [
          "A shell that loads each animation, which the site calls a virus, into an iframe and switches to another at a random interval of 2 to 11 seconds, with skip, pause, reload, fullscreen and keyboard controls. There are 17 viruses, among them a 3D claw-crane game on Three.js and Rapier physics, a GLSL sky timelapse with shifting cloud cover, a shell game in canvas line art where the eye from the dollar bill watches mushroom caps shuffle and double from 3 to 24 and shoots some of them, and Doors, columns of colored bars that slide open and shut at different speeds. A Lab lets visitors blend two viruses into a mix that is saved in the browser and joins the playlist, and a searchable gallery and a Share button link to any single virus.",
        ],
      },
      {
        heading: "How it works",
        paragraphs: [
          "Vite builds the site as a multi-page app with one entry per virus folder and copies each virus's images, models and media with no config edits. In development a direct virus URL redirects to the shell, while iframe requests are exempt.",
          "A Stage component owns what is on screen. If a new load starts before the last one finishes, the old one's callbacks are ignored. The loading cover stays up for at least 500 ms, and an iframe that hasn't loaded after 5 seconds is shown anyway and reported to Sentry. Transitions use the Web Animations API, including an eyelid blink built from animated clip-path polygons, and the same transition never plays twice in a row.",
          "A virus such as the crane game can ask the shell for keyboard control. The shell then forwards key events to it with postMessage, and both sides check the message's origin and source.",
          "A mix needs no new rendering code: it stacks two virus iframes and blends the top one with mix-blend-mode: screen at an adjustable opacity.",
        ],
      },
      {
        heading: "Where it stands",
        paragraphs: [
          "Live and deployed through AWS Amplify. Google Analytics counted 1,434 visitors and about 2,700 page views in October 2026. Every pull request to master runs lint, a format check, type checks, tests and a build.",
        ],
      },
    ],
  },
  {
    id: "summon-a-demon",
    title: "Summon a demon",
    stack: ["JavaScript", "three.js", "GLSL", "Web Audio"],
    href: "https://summonademon.net",
    role: "Sole author",
    years: "2026",
    images: [
      {
        src: "/work/summon-a-demon/summoning.webp",
        width: 4320,
        height: 2610,
        alt: "A burning pentagram rises from the pool, framed by torches and a dense forest of twisted trees.",
      },
      {
        src: "/work/summon-a-demon/demon.webp",
        width: 2880,
        height: 1740,
        alt: "A horned demon with outstretched wings burns into view above the pool against a red sky.",
      },
      {
        src: "/work/summon-a-demon/ghost.webp",
        width: 2880,
        height: 1740,
        alt: "A ghost girl with streaming hair floats above the pool, surrounded by flames and twisted treetops.",
      },
      {
        src: "/work/summon-a-demon/shatter.webp",
        width: 2880,
        height: 1740,
        alt: "The pentagram ending: the screen's glass cracked outward from a hole in the middle, over a red sky.",
      },
    ],
    sections: [
      {
        heading: "The problem",
        paragraphs: [
          "Summon a demon turns live microphone input into a 3D scene you play with your voice. Louder sound makes bigger waves, brighter sound makes tighter rings, and holding a pitched sound for two seconds starts a summoning. I made it for fun.",
        ],
      },
      {
        heading: "What I built",
        paragraphs: [
          "I built the interaction, scene and effects in one three.js page. A pool sits in a dense forest of tall, twisted trees, lit by torches and rendered with a 16-bit look. During a summoning, wounded trees bleed more heavily and the treetops bend over the pool like claws.",
          "A burning pentagram rises from the water, then one of three endings plays: it flies at the screen and shatters the glass, a winged demon burns into view and roars, or a ghost girl appears with her hair streaming. I used third-party character models and animations, then added the fire and material effects. Sound effects are generated live with the Web Audio API, and the browser's speech synthesis announces the outcome.",
        ],
      },
      {
        heading: "How it works",
        paragraphs: [
          "The water is a 160 by 160 height grid stepped 120 times a second. Mic volume sets wave height, and the spectral centroid, the brightness of the sound, sets ring frequency. Separately, the YIN method detects whether there is a sung or played note. A 500 ms grace period keeps brief gaps from resetting the two-second hold, and touch screens use lower loudness thresholds.",
          "The demon and ghost share the same effect: flames leave the pentagram and land on the model as a shader burns its skin into view, then burns it away. Each keeps its own animation. A character joins the random selection only after its model has loaded.",
          "The forest reacts to the same summoning timeline. A shader makes the blood flow faster and spread wider, while another bends the upper branches toward the pool. The lower trunks stay planted so the wounds and blood remain aligned.",
          "On screens 4:3 or wider the scene renders at 224 lines high, a 16-bit console's height, then gets 16-level Bayer dithering. Narrow screens widen the field of view so the pool stays in frame.",
        ],
      },
      {
        heading: "Where it stands",
        paragraphs: [
          "Live at summonademon.net, hosted on AWS Amplify. Everyone I have shown it to found it hilarious.",
        ],
      },
    ],
  },
  {
    id: "pr-review-loop",
    title: "PR review loop",
    stack: ["Python", "Bash", "GitHub CLI", "GitHub Actions"],
    source: "https://github.com/pulsedemon/pr-review-loop-skill",
    role: "Author",
    years: "2026",
    cycle: ["Review", "Fix", "CI", "Repeat"],
    sections: [
      {
        heading: "The problem",
        paragraphs: [
          "Running an AI reviewer once only gives you a list of comments. Someone still has to apply the fixes, run the review again, wait for CI and decide when to stop. Once the loop handled that, I found Copilot often raised real issues after it finished that the panel had missed, and reducing those misses became a goal of its own.",
        ],
      },
      {
        heading: "What I built",
        paragraphs: [
          "A skill you install into Cursor, Claude Code, Codex or opencode. It instructs the host agent to coordinate specialist reviewers, fix blockers, run the repository's checks and handle PR feedback, with a separate adversarial review before approval. Python and Bash helpers validate findings, choose reviewers, push, wait for CI and compute stopping conditions. The skill tells the agent to leave merging to a person.",
        ],
      },
      {
        heading: "How it works",
        paragraphs: [
          "Reviewers are required to return JSON, which a script validates before synthesis. Duplicate findings merge by a fixed matching rule, and one script owns the rules for promoting suggestions to blockers.",
          "Later rounds can run a separate relevance check for each reviewer against the latest changes. The procedure requires invalid answers to be discarded. A selection script includes reviewers that owned blockers and any whose answer is missing. When a reduced panel finds no blockers, the procedure requires a full panel review before the adversarial pass.",
          "The push helper refuses protected branch names and the wrong local branch. It checks that the remote is still at the expected commit and that the new commit builds on it, then pushes that exact commit with a lease and hooks enabled.",
          "The procedure waits for CI on the approval path and turns failed checks into blockers. Before success, a completion helper checks the recorded reviews, adversarial response, matching local and remote commits, and required comment replies. It also computes the stopping conditions for repeated blockers and repeated CI failures.",
          "Prompts are treated as code. A shared reviewer manifest generates parts of the skill file and output schema, with CI checking for drift. I also built an offline tool that compares external review comments against the loop's findings and uses manual labels to report missed issues.",
        ],
      },
      {
        heading: "Where it stands",
        paragraphs: [
          "The source is public under the MIT license. CI checks the helpers, shell scripts, Python, Markdown and generated files.",
          "Recorded Codex runs cover live GitHub approval and a local edit loop. An integrated Claude Code run demonstrated a verified repair and push, green CI and an accurate summary of the adversary's suggestion. Its audit records permission and comment-snapshot recovery limits. Installer checks cover all supported hosts; Cursor and opencode have no recorded runtime verification.",
        ],
      },
    ],
  },
  {
    id: "cf-com",
    title: "cf.com",
    stack: ["React", "TanStack Start", "Storyblok", "Azure"],
    href: "https://cf.com",
    role: "Sole frontend developer",
    years: "Chatham Financial",
    images: [
      {
        src: "/work/cf-com/home.webp",
        width: 4320,
        height: 2610,
        alt: 'The cf.com home page: a ChatFIN prompt reading "Ask me about Chatham", a row of news and insights, and the start of the calculators section.',
      },
      {
        src: "/work/cf-com/rates.webp",
        width: 2880,
        height: 1740,
        alt: "cf.com's market rates page: tabs for U.S., Canada, Europe, Asia-Pacific and FX rates, and a U.S. Treasury yields table setting the latest rate beside the rates two days, one month and one year earlier, with the latest column blurred behind a lock.",
      },
      {
        src: "/work/cf-com/calculator.webp",
        width: 2880,
        height: 1740,
        alt: "cf.com's interest rate cap calculator: notional, term and strike inputs on the left and an indicative price on the right.",
      },
    ],
    sections: [
      {
        heading: "The problem",
        paragraphs: [
          "Chatham Financial rebranded, and its public site moved from chathamfinancial.com to cf.com as part of that. The new site serves prospects and existing clients alike, and much of its traffic comes for the market rates pages. It is a marketing site, so it also had to rank well in search.",
        ],
      },
      {
        heading: "What I built",
        paragraphs: [
          "I was the only frontend developer on a small team formed for the rebuild: me, a couple of designers and a couple of backend developers. We built and launched the whole site in about three months, and that speed is what I'm proudest of.",
          "The frontend covers market rates for the U.S., Canada, Europe, Asia-Pacific and FX, calculators for interest rate caps, defeasance and yield maintenance, news and insights, registration and login, and waitlist pages for two upcoming products, Portfolio and Originations.",
          "ChatFIN, the site's chat assistant, was a collaboration with another team. I built its first prototype, it was rebuilt during the rebrand, and I did much of its maintenance after that.",
        ],
      },
      {
        heading: "How it works",
        paragraphs: [
          "The site is React on TanStack Start. The UI team, which I was part of, evaluated several frameworks and libraries, compared TanStack with Next.js and chose TanStack. Nearly all data is fetched on the server, with a few small exceptions, so pages reach search engines as finished HTML. Server rendering was new to me when the project started.",
          "Rates come from Chatham's own pipelines, which pull data from several sources and serve it through Chatham's APIs. The calculators send their inputs to those APIs and show what comes back.",
          "Full rates and calculator data need a login. Registration is free and gives an account called Chatham ONYX Pro, and corporate clients get more rates features on top of it. Logged out, a visitor sees some figures and finds the rest blurred behind a lock.",
          "Content lives in Storyblok. The marketing team writes and edits articles, previews drafts, chooses which articles are featured, and updates pages such as the terms and the privacy policy without a developer.",
          "The site runs in a container on Azure, behind Cloudflare.",
        ],
      },
      {
        heading: "Where it stands",
        paragraphs: [
          "Live at cf.com. When I last saw the numbers it had at least 30,000 active users a month. I worked on it until I left Chatham in October 2026.",
        ],
      },
    ],
  },
];

/** the widths of a screenshot's smaller copies, at `<name>-<width>.webp`: those narrower than the file, unless its `copies` lists others. */
const COPY_WIDTHS = [1440, 2048, 2880];
const copyWidths = ({ width, copies }: Screenshot) => copies ?? COPY_WIDTHS.filter((w) => w < width);
const copy = (src: string, width: number) => src.replace(/\.webp$/, `-${width}.webp`);

export const srcSet = (image: Screenshot) =>
  [...copyWidths(image).map((w) => `${copy(image.src, w)} ${w}w`), `${image.src} ${image.width}w`].join(", ");

// a copy's height rounds the way ImageMagick's `-resize <width>x` does.
const fileSizes = new Map(
  projects
    .flatMap((p) => p.images ?? [])
    .flatMap((image) => [
      [image.src, { width: image.width, height: image.height }] as const,
      ...copyWidths(image).map(
        (w) => [copy(image.src, w), { width: w, height: Math.round((image.height * w) / image.width) }] as const,
      ),
    ]),
);

/** the pixel size of the screenshot file at `path`, the original or a copy. */
export const screenshotSize = (path: string) => must(fileSizes.get(path));

type Job = {
  id: string;
  company: string;
  role: string;
  span: string;
  note?: string;
};

export const jobs: Job[] = [
  {
    id: "big-idea",
    company: "Big Idea Group",
    role: "Founding partner",
    span: "2006 to 2007",
    note: "Freelancing alongside it until 2011.",
  },
  { id: "huge", company: "HUGE", role: "Software developer", span: "2007 to 2009" },
  { id: "ultra16", company: "Ultra 16", role: "Software developer", span: "2009 to 2010" },
  { id: "2x4", company: "2x4", role: "Programmer", span: "2010 to 2011" },
  { id: "cantata-dev", company: "Cantata Media", role: "Senior developer", span: "2011 to 2013" },
  { id: "google", company: "Google", role: "User experience prototyper", span: "2013 to 2014" },
  { id: "cantata-dir", company: "Cantata Media", role: "Director of technology", span: "2014 to 2017" },
  { id: "zipari", company: "Zipari", role: "Senior software developer, Core API team", span: "2017 to 2019" },
  { id: "operatic", company: "Operatic", role: "Senior software developer", span: "2019 to 2022" },
  { id: "freelance", company: "Freelance", role: "Software developer", span: "2022 to 2023" },
  { id: "chatham", company: "Chatham Financial", role: "Senior React developer, full-stack", span: "2023 to 2026" },
];

export const contact = {
  email: "msquashicdev@gmail.com",
  linkedin: "https://www.linkedin.com/in/michaelsquashic",
  github: "https://github.com/pulsedemon",
};
