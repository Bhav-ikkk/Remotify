import { z } from "zod";

export const JobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  salary: z.string().nullable(),
  currency: z.string().nullable(),
  employmentType: z.string().nullable(),
  experience: z.string().nullable(),
  description: z.string(),
  skills: z.array(z.string()),
  applyUrl: z.string().url(),
  companyUrl: z.string().url().nullable(),
  sourceWebsite: z.string(),
  postedDate: z.date().nullable(),
  scrapedAt: z.date(),
});

export const ScraperOutputSchema = z.array(JobSchema);
