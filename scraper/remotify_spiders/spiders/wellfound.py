"""Wellfound remote software engineering spider for Zyte Scrapy Cloud.

Yields plain dicts matching the Next.js JobSchema keys used by Remotify.
"""

from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urljoin

import scrapy


class WellfoundSpider(scrapy.Spider):
    name = "wellfound"
    allowed_domains = ["wellfound.com", "www.wellfound.com"]

    start_urls = [
        "https://wellfound.com/role/l/software-engineer/remote",
        "https://wellfound.com/role/r/software-engineer/l/remote",
        "https://wellfound.com/jobs?remote=true&role=engineering",
    ]

    custom_settings = {
        "DEFAULT_REQUEST_HEADERS": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
        },
        "DOWNLOAD_DELAY": 1.25,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
        "COOKIES_ENABLED": True,
    }

    def parse(self, response):
        scraped_at = datetime.now(timezone.utc).isoformat()
        seen = set()

        # Primary: job detail anchors on listing pages.
        for href in response.css("a[href*='/jobs/']::attr(href)").getall():
            apply_url = urljoin(response.url, href.split("?")[0])
            if "/jobs/" not in apply_url or apply_url in seen:
                continue
            if any(skip in apply_url for skip in ("/jobs?", "/jobs#", "/jobs/new")):
                continue
            seen.add(apply_url)
            yield response.follow(
                apply_url,
                callback=self.parse_job,
                cb_kwargs={"scraped_at": scraped_at},
            )

        # Fallback: structured cards / titles when detail crawl is thin.
        for card in response.css("[data-test='JobSearchResult'], article, li"):
            title = self._first_text(
                card,
                [
                    "[data-test='StartupResultRoleTitle']::text",
                    "h2::text",
                    "h3::text",
                    "a[href*='/jobs/']::text",
                ],
            )
            company = self._first_text(
                card,
                [
                    "[data-test='StartupResultCompanyName']::text",
                    "h4::text",
                    "[class*='companyName']::text",
                ],
            )
            href = card.css("a[href*='/jobs/']::attr(href)").get()
            if not title or not href:
                continue
            apply_url = urljoin(response.url, href.split("?")[0])
            if apply_url in seen:
                continue
            seen.add(apply_url)
            yield self._job_dict(
                title=title,
                company=company or "Unknown Company",
                location=self._first_text(card, ["[data-test='JobSearchResultLocation']::text"])
                or "Remote",
                description=self._first_text(card, ["p::text"])
                or f"{title} — software role listed on Wellfound.",
                apply_url=apply_url,
                company_url=None,
                skills=self._extract_skills(card.get()),
                scraped_at=scraped_at,
            )

        for next_href in response.css("a[rel='next']::attr(href), a.next::attr(href)").getall():
            yield response.follow(next_href, callback=self.parse)

    def parse_job(self, response, scraped_at):
        title = self._first_text(
            response,
            [
                "h1::text",
                "[data-test='JobTitle']::text",
                "meta[property='og:title']::attr(content)",
            ],
        )
        if not title:
            return

        company = self._first_text(
            response,
            [
                "[data-test='StartupLink']::text",
                "a[href*='/company/']::text",
                "meta[property='og:site_name']::attr(content)",
            ],
        ) or "Unknown Company"

        location = self._first_text(
            response,
            [
                "[data-test='JobLocation']::text",
                "[data-test='StartupLocation']::text",
            ],
        ) or "Remote"

        description_bits = response.css(
            "[data-test='JobDescription'] *::text, "
            "article *::text, "
            ".job-description *::text"
        ).getall()
        description = " ".join(t.strip() for t in description_bits if t and t.strip())
        if len(description) < 40:
            description = (
                response.css("meta[name='description']::attr(content)").get()
                or f"{title} at {company} — remote software role on Wellfound."
            )

        company_href = response.css("a[href*='/company/']::attr(href)").get()
        company_url = urljoin(response.url, company_href) if company_href else None

        skills = self._extract_skills(response.text)
        salary, currency = self._extract_salary(response.text)

        yield self._job_dict(
            title=title.strip(),
            company=company.strip(),
            location=location.strip(),
            description=description[:8000],
            apply_url=response.url.split("?")[0],
            company_url=company_url,
            skills=skills,
            salary=salary,
            currency=currency,
            scraped_at=scraped_at,
        )

    def _job_dict(
        self,
        *,
        title,
        company,
        location,
        description,
        apply_url,
        company_url,
        skills,
        scraped_at,
        salary=None,
        currency=None,
        employment_type=None,
        experience=None,
        posted_date=None,
    ):
        return {
            "title": title,
            "company": company,
            "location": location or "Remote",
            "salary": salary,
            "currency": currency,
            "employmentType": employment_type,
            "experience": experience,
            "description": description or f"{title} at {company}",
            "skills": skills if isinstance(skills, list) else [],
            "applyUrl": apply_url,
            "companyUrl": company_url,
            "sourceWebsite": "wellfound",
            "postedDate": posted_date,
            "scrapedAt": scraped_at,
        }

    @staticmethod
    def _first_text(selector, queries):
        for query in queries:
            try:
                value = selector.css(query).get()
            except Exception:
                value = None
            if value and value.strip():
                return value.strip()
        return None

    @staticmethod
    def _extract_skills(text):
        if not text:
            return []
        hay = text.lower()
        catalog = [
            ("javascript", "JavaScript"),
            ("typescript", "TypeScript"),
            ("react", "React"),
            ("node.js", "Node.js"),
            ("nodejs", "Node.js"),
            ("python", "Python"),
            ("ruby", "Ruby"),
            ("golang", "Go"),
            (" kubernetes", "Kubernetes"),
            ("docker", "Docker"),
            ("aws", "AWS"),
            ("postgresql", "PostgreSQL"),
            ("postgres", "PostgreSQL"),
        ]
        found = []
        for needle, label in catalog:
            if needle in hay and label not in found:
                found.append(label)
        return found

    @staticmethod
    def _extract_salary(text):
        import re

        if not text:
            return None, None
        match = re.search(
            r"\$\s?([\d,]+)\s*(?:-|–|to)\s*\$?\s*([\d,]+)",
            text,
            re.IGNORECASE,
        )
        if match:
            return f"${match.group(1)} - ${match.group(2)}", "USD"
        single = re.search(r"\$\s?([\d,]{2,})", text)
        if single:
            return f"${single.group(1)}", "USD"
        return None, None
