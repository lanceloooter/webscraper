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
  keyword = '',
  maxItems = 0,
  proxyConfiguration = undefined,
} = input;

const proxy = await Actor.createProxyConfiguration(proxyConfiguration);
const itemLimit = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : Number.POSITIVE_INFINITY;

let pushed = 0;
const seen = new Set();

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

const buildSearchUrl = (title, targetCountry) => {
  const kw = encodeURIComponent(title);
  const loc = encodeURIComponent(targetCountry);
  return `https://www.glassdoor.com/Job/jobs.htm?keyword=${kw}&locT=N&locKeyword=${loc}`;
};

const trimmedJobTitles = (Array.isArray(jobTitles) ? jobTitles : DEFAULT_JOB_TITLES)
  .map((t) => normalize(t))
  .filter(Boolean);

const seedRequests = (Array.isArray(startUrls) && startUrls.length > 0)
  ? startUrls.map((req) => ({
      ...req,
      userData: {
        ...(req.userData ?? {}),
        keyword: normalize(req.userData?.keyword ?? keyword),
      },
    }))
  : trimmedJobTitles.map((title) => ({
      url: buildSearchUrl(title, country),
      userData: { keyword: title },
    }));

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
        if (!fullUrl || seen.has(fullUrl)) continue;
        seen.add(fullUrl);

        await crawler.addRequests([
          {
            url: fullUrl,
            label: 'DETAIL',
            userData: {
              fallbackTitle: normalize(card.title),
              keyword: normalize(request.userData?.keyword ?? keyword),
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

    await Actor.pushData(out);
    pushed += 1;

    if (pushed % 20 === 0) {
      const limitLabel = Number.isFinite(itemLimit) ? String(itemLimit) : 'unlimited';
      log.info(`Pushed ${pushed}/${limitLabel} items`);
    }
  },
});

await crawler.run(seedRequests);

log.info(`Finished. Pushed ${pushed} items.`);
await Actor.exit();
