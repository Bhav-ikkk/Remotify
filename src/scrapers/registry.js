import { scrape as scrapeSkipTheDrive } from "./skipthedrive.js";
import { scrape as scrapeBuiltIn } from "./builtin.js";
import { scrape as scrapeUnderdog } from "./underdog.js";
import { scrape as scrapeJobgether } from "./jobgether.js";
import { scrape as scrapeWellfound } from "./wellfound.js";
import { scrape as scrapeRemotive } from "./remotive.js";
import { scrape as scrapeRemoteOk } from "./remoteok.js";
import { scrape as scrapeHimalayas } from "./himalayas.js";
import { scrape as scrapeArbeitnow } from "./arbeitnow.js";
import { scrape as scrapeAtsBoards } from "./ats-boards.js";

/** Canonical scraper registry for pipeline / persist / tests. */
export const SCRAPERS = [
  { name: "ats-boards", label: "ATS Boards", run: scrapeAtsBoards },
  { name: "remotive", label: "Remotive", run: scrapeRemotive },
  { name: "remoteok", label: "RemoteOK", run: scrapeRemoteOk },
  { name: "himalayas", label: "Himalayas", run: scrapeHimalayas },
  { name: "arbeitnow", label: "Arbeitnow", run: scrapeArbeitnow },
  { name: "skipthedrive", label: "SkipTheDrive", run: scrapeSkipTheDrive },
  { name: "builtin", label: "Built In", run: scrapeBuiltIn },
  { name: "underdog", label: "Underdog", run: scrapeUnderdog },
  { name: "jobgether", label: "Jobgether", run: scrapeJobgether },
  { name: "wellfound", label: "Wellfound", run: scrapeWellfound },
];
