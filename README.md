# Classdoor/Glassdoor Apify Actor

This actor scrapes job listings and outputs records.
Default setup targets United States and your partnership-related job titles.
It also sweeps salary ranges in increments, applies a 30-day posted filter, and deduplicates overlaps.
Anti-block controls are included (session/cookie persistence, retries on blocked pages, throttling, and random delays).

## Output columns
- Title
- Title_URL
- Name
- ratingsinglestar_ratingtext_5fdjn
- Location
- Salary
- Description
- Description2
- Keyword
- date_extracted

## Local run
1. `npm install`
2. `npm start`

## Output files
- Dataset items (standard Apify output)
- `OUTPUT.csv` in Key-Value Store (same columns as dataset)

## Default job titles
- Partner Manager
- Partnerships Manager
- Partner Sales Manager
- Partner Success Manager
- Strategic Partnerships Manager
- Partner Marketing Manager
- Director of Partnerships
- Partner Enablement Manager
- Head of Partnerships
- Partner Operations Manager
- VP of Partnerships
- Alliances Manager
- Channel Director
- Chief Partner Officer

## Apify input example (unlimited)
```json
{
  "startUrls": [],
  "jobTitles": [
    "Partner Manager",
    "Partnerships Manager",
    "Partner Sales Manager",
    "Partner Success Manager",
    "Strategic Partnerships Manager",
    "Partner Marketing Manager",
    "Director of Partnerships",
    "Partner Enablement Manager",
    "Head of Partnerships",
    "Partner Operations Manager",
    "VP of Partnerships",
    "Alliances Manager",
    "Channel Director",
    "Chief Partner Officer"
  ],
  "country": "United States",
  "salaryMin": 0,
  "salaryMax": 300000,
  "salaryStep": 10000,
  "postedWithinDays": 30,
  "maxItems": 0,
  "maxConcurrency": 1,
  "maxRequestsPerMinute": 6,
  "minDelayMs": 2500,
  "maxDelayMs": 7000,
  "proxyConfiguration": { "useApifyProxy": true }
}
```
