import { z } from "zod";

export const HimalayasLocationSchema = z
  .object({
    alpha2: z.string().length(2),
    name: z.string().min(1),
    slug: z.string().min(1),
  })
  .passthrough();

export const HimalayasEmploymentTypeSchema = z.enum([
  "Full Time",
  "Part Time",
  "Contractor",
  "Temporary",
  "Intern",
  "Volunteer",
  "Other",
]);
export const HimalayasSenioritySchema = z.enum([
  "Entry-level",
  "Mid-level",
  "Senior",
  "Manager",
  "Director",
  "Executive",
]);
export const HimalayasCurrencySchema = z.enum([
  "USD",
  "AUD",
  "EUR",
  "JPY",
  "GBP",
  "CAD",
  "CHF",
  "CNY",
  "HKD",
  "NZD",
  "SGD",
  "SEK",
  "KRW",
  "NOK",
  "INR",
  "MXN",
  "TWD",
  "ZAR",
  "BRL",
  "IDR",
  "PHP",
  "THB",
  "CLP",
  "CZK",
  "DKK",
  "HUF",
  "ILS",
  "TRY",
  "PLN",
]);
export const HimalayasSalaryPeriodSchema = z.enum([
  "hourly",
  "weekly",
  "fortnightly",
  "monthly",
  "annual",
]);

export const HimalayasJobSchema = z
  .object({
    title: z.string(),
    excerpt: z.string(),
    companyName: z.string(),
    companySlug: z.string(),
    companyLogo: z.url(),
    employmentType: HimalayasEmploymentTypeSchema,
    minSalary: z.number().finite().nonnegative().nullable().optional(),
    maxSalary: z.number().finite().nonnegative().nullable().optional(),
    seniority: z.array(HimalayasSenioritySchema),
    currency: HimalayasCurrencySchema,
    salaryPeriod: HimalayasSalaryPeriodSchema,
    locationRestrictions: z.array(HimalayasLocationSchema),
    timezoneRestrictions: z.array(z.string()),
    categories: z.array(z.string()),
    parentCategories: z.array(z.string()),
    description: z.string(),
    pubDate: z.number().int().nonnegative(),
    expiryDate: z.number().int().nonnegative(),
    applicationLink: z.url(),
    guid: z.string().min(1),
  })
  .passthrough();

export const HimalayasPageSchema = z
  .object({
    comments: z.string().optional(),
    updatedAt: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(20),
    totalCount: z.number().int().nonnegative(),
    jobs: z.array(HimalayasJobSchema),
  })
  .passthrough();

export type HimalayasPage = z.infer<typeof HimalayasPageSchema>;
export type HimalayasJob = z.infer<typeof HimalayasJobSchema>;
