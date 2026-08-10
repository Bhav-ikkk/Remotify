import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const jobs = await p.job.count();
const recent = await p.job.findMany({
  orderBy: { scrapedAt: "desc" },
  take: 5,
  select: { title: true, company: true, sourceWebsite: true, aiScore: true, applyUrl: true },
});
const profile = await p.candidateProfile.findFirst({
  where: { isActive: true },
  select: {
    fullName: true,
    slug: true,
    _count: { select: { skills: true, projects: true, priorities: true } },
  },
});
const settings = await p.setting.findMany({
  where: {
    key: {
      in: [
        "zyte_api_key",
        "zyte_project_id",
        "telegram_bot_token",
        "telegram_chat_id",
        "min_match_score",
        "target_profile",
      ],
    },
  },
});

console.log(
  JSON.stringify(
    {
      jobs,
      profile,
      recent,
      settings: settings.map((s) => ({
        key: s.key,
        type: typeof s.value,
        nonempty:
          s.value != null &&
          s.value !== "" &&
          !(typeof s.value === "string" && !s.value.trim()),
      })),
    },
    null,
    2
  )
);

await p.$disconnect();
