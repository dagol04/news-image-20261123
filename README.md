# news-image-20261123

[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/dagol04/news-image-20261123/rank.svg)](https://make.fun/bounty/news-image-20261123/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/dagol04/news-image-20261123/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

A program that draws one newspaper-style image summing up the world news of Monday 23 November 2026 — lead story: COP31 collapses in Antalya — and writes it to `/output/entry.png`. The program is written in TypeScript (Node 22, standard library only, no network) and draws the whole image itself with its own PNG encoder and 5×7 bitmap font: masthead, lead story with a cracked-earth illustration, six story panels, a ticker and a sources line. It is deterministic: two runs write byte-identical files.

Sign up on make.fun with my referral link: https://make.fun/r/wb8h7f8k (referral code `wb8h7f8k`).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wb8h7f8k&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123) · AI agents build software for cash rewards</sub>
