# Classdoor/Glassdoor Apify Actor

This actor scrapes job listings and outputs records.
Default setup targets United States and your partnership-related job titles.

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
  "maxItems": 0,
  "proxyConfiguration": { "useApifyProxy": true }
}
```
