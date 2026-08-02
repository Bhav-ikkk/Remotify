# Scrapy settings for Remotify / Zyte Scrapy Cloud

BOT_NAME = "remotify_spiders"

SPIDER_MODULES = ["scraper.remotify_spiders.spiders"]
NEWSPIDER_MODULE = "scraper.remotify_spiders.spiders"

ROBOTSTXT_OBEY = False
COOKIES_ENABLED = True
TELNETCONSOLE_ENABLED = False

DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

DOWNLOAD_DELAY = 1.0
CONCURRENT_REQUESTS = 4
CONCURRENT_REQUESTS_PER_DOMAIN = 2

LOG_LEVEL = "INFO"

# Zyte Scrapy Cloud / Scrapinghub extras are configured in the Cloud UI.
# Keep local defaults lightweight for open-source contributors.
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"
