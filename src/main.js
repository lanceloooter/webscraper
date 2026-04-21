import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';

await Actor.init();

const DEFAULT_JOB_TITLES = [
  'Partner Manager',
  'Partnerships Manager',
  'Partner Sales Manager',
  'Partner Success Manager',
  'Strategic Partnerships Manager',
  'Partner Marketing Manager',
  'Director of Partnerships',
  'Partner Enablement Manager',
  'Head of Partnerships',
  'Partner Operations Manager',
  'VP of Partnerships',
  'Alliances Manager',
  'Channel Director',
  'Chief Partner Officer',
];

const input = await Actor.getInput() ?? {};
const {
  startUrls = [],
  jobTitles = DEFAULT_JOB_TITLES,
  country = 'United States',
  salaryMin = 32000,
  salaryMax = 200000,
  salaryStep = 20000,
  postedWithinDays = 30,
  keyword = '',
  maxItems = 0,
  proxyConfiguration = undefined,
} = input;

const proxy = await Actor.createProxyConfiguration(proxyConfiguration);
const itemLimit = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : Number.POSITIVE_INFINITY;

let pushed = 0;
const seen = new Set();
const emitted = new Set();

const normalize = (value) => {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
};

const toAbsUrl = (url, base) => {
  if (!url) return '';
  try {
    return new URL(url, base).toString();
  } catch {
    return '';
  }
};

const toSlug = (text) => normalize(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const buildSearchUrl = (title, targetCountry, minSalary, maxSalary, daysAgo) => {
  const countrySlug = toSlug(targetCountry);
  const titleSlug = toSlug(title);
  const searchSlug = `${countrySlug}-${titleSlug}-jobs`;
  const koStart = countrySlug.length + 1;
  const koEnd = koStart + titleSlug.length;
  return `https://www.glassdoor.com/Job/${searchSlug}-SRCH_IL.0,${countrySlug.length}_IN1_KO${koStart},${koEnd}.htm?fromAge=${daysAgo}&minSalary=${minSalary}&maxSalary=${maxSalary}`;
};

const getSalaryBands = (minSalary, maxSalary, step) => {
  const min = Math.max(0, Number(minSalary) || 0);
  const max = Math.max(min, Number(maxSalary) || min);
  const safeStep = Math.max(1000, Number(step) || 10000);
  const bands = [];
  for (let start = min; start <= max; start += safeStep) {
    const end = Math.min(start + safeStep - 1, max);
    bands.push([start, end]);
  }
  return bands;
};

const canonicalJobKey = (rawUrl) => {
  try {
    const u = new URL(rawUrl);
    const jl = u.searchParams.get('jl');
    if (jl) return `jl:${jl}`;
    return `${u.origin}${u.pathname}`;
  } catch {
    return rawUrl;
  }
};

const trimmedJobTitles = (Array.isArray(jobTitles) ? jobTitles : DEFAULT_JOB_TITLES)
  .map((t) => normalize(t))
  .filter(Boolean);

const OUTPUT_COLUMNS = [
  'Title',
  'Title_URL',
  'Name',
  'ratingsinglestar_ratingtext_5fdjn',
  'Location',
  'Salary',
  'Description',
  'Description2',
  'Keyword',
  'date_extracted',
];

const csvEscape = (value) => {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
};

const seedRequests = (Array.isArray(startUrls) && startUrls.length > 0)
  ? startUrls.map((req) => ({
      ...req,
      userData: {
        ...(req.userData ?? {}),
        keyword: normalize(req.userData?.keyword ?? keyword),
      },
    }))
  : trimmedJobTitles.flatMap((title) => getSalaryBands(salaryMin, salaryMax, salaryStep).map(([bandMin, bandMax]) => ({
      url: buildSearchUrl(title, country, bandMin, bandMax, postedWithinDays),
      userData: {
        keyword: title,
        salaryBand: `${bandMin}-${bandMax}`,
      },
    })));

const crawler = new PlaywrightCrawler({
  proxyConfiguration: proxy,
  maxRequestRetries: 3,
  navigationTimeoutSecs: 90,
  requestHandlerTimeoutSecs: 120,
  maxConcurrency: 10,

  async requestHandler({ page, request, enqueueLinks }) {
    if (pushed >= itemLimit) return;

    await page.waitForLoadState('domcontentloaded');

    const isDetailPage = /\/jobListing\?|\/partner\/jobListing\.htm/i.test(request.loadedUrl ?? request.url);

    if (!isDetailPage) {
      await page.waitForTimeout(2000);

      const cards = await page.$$eval('a[href*="jobListing"], li[data-test*="job"] a[href], article a[href*="job"]', (anchors) => {
        const unique = new Map();

        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          if (!href) continue;

          const item = {
            href,
            title: (a.textContent || '').trim(),
          };

          if (!unique.has(href)) unique.set(href, item);
        }

        return [...unique.values()].slice(0, 100);
      });

      for (const card of cards) {
        if (pushed >= itemLimit) break;
        const fullUrl = toAbsUrl(card.href, request.loadedUrl ?? request.url);
        const key = canonicalJobKey(fullUrl);
        if (!fullUrl || seen.has(key)) continue;
        seen.add(key);

        await crawler.addRequests([
          {
            url: fullUrl,
            label: 'DETAIL',
            userData: {
              fallbackTitle: normalize(card.title),
              keyword: normalize(request.userData?.keyword ?? keyword),
              salaryBand: request.userData?.salaryBand ?? '',
            },
          },
        ]);
      }

      await enqueueLinks({
        globs: ['**/Job/**', '**/jobs.htm**', '**/Jobs/**'],
        strategy: 'same-domain',
      });

      return;
    }

    const data = await page.evaluate(() => {
      const txt = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const allText = (selectors) => {
        for (const s of selectors) {
          const v = txt(s);
          if (v) return v;
        }
        return '';
      };

      const title = allText([
        'h1[data-test="job-title"]',
        'h1.jobsearch-JobInfoHeader-title',
        'h1',
      ]);

      const company = allText([
        'div[data-test="employer-name"]',
        'span[data-test="employer-name"]',
        '.EmployerProfile_compactEmployerName__LE242',
        '[data-test="employer-name"]',
      ]);

      const rating = allText([
        '[data-test="employer-rating"]',
        '.rating-single-star_RatingText',
        '[class*="rating-single-star"][class*="RatingText"]',
      ]);

      const location = allText([
        'div[data-test="job-location"]',
        'span[data-test="job-location"]',
        '.JobDetails_location__mSg5h',
        '[data-test="location"]',
      ]);

      const salary = allText([
        '[data-test="detailSalary"]',
        '[data-test="salary"]',
        '.JobDetails_salaryEstimate__QpbTW',
      ]);

      const description = allText([
        '[data-test="jobDescriptionContainer"]',
        '.JobDetails_jobDescription__uW_fK',
        '#JobDescriptionContainer',
      ]);

      const description2 = allText([
        '[data-test="benefits"]',
        '[data-test="qualifications"]',
        '.JobDetails_jobDescriptionWrapper__nPB_4',
      ]);

      return {
        title,
        company,
        rating,
        location,
        salary,
        description,
        description2,
      };
    });

    const title = normalize(data.title || request.userData?.fallbackTitle || '');
    if (!title) return;

    const out = {
      Title: title,
      Title_URL: request.loadedUrl ?? request.url,
      Name: normalize(data.company),
      ratingsinglestar_ratingtext_5fdjn: normalize(data.rating),
      Location: normalize(data.location),
      Salary: normalize(data.salary),
      Description: normalize(data.description),
      Description2: normalize(data.description2),
      Keyword: normalize(request.userData?.keyword ?? keyword),
      date_extracted: new Date().toISOString(),
    };

    const dedupKey = `${canonicalJobKey(out.Title_URL)}|${out.Title}|${out.Name}`;
    if (emitted.has(dedupKey)) return;
    emitted.add(dedupKey);

    await Actor.pushData(out);
    pushed += 1;

    if (pushed % 20 === 0) {
      const limitLabel = Number.isFinite(itemLimit) ? String(itemLimit) : 'unlimited';
      log.info(`Pushed ${pushed}/${limitLabel} items`);
    }
  },
});

await crawler.run(seedRequests);

const { items } = await Actor.apifyClient.dataset(Actor.config.defaultDatasetId).listItems({ clean: true });
const csvLines = [
  OUTPUT_COLUMNS.join(','),
  ...items.map((item) => OUTPUT_COLUMNS.map((col) => csvEscape(item[col])).join(',')),
];
await Actor.setValue('OUTPUT.csv', csvLines.join('\n'), { contentType: 'text/csv; charset=utf-8' });

log.info(`Finished. Pushed ${pushed} items.`);
await Actor.exit();
