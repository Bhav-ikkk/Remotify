# Scrapy item definitions — spiders may also yield plain dicts matching JobSchema.
import scrapy


class RemotifyJobItem(scrapy.Item):
    title = scrapy.Field()
    company = scrapy.Field()
    location = scrapy.Field()
    salary = scrapy.Field()
    currency = scrapy.Field()
    employmentType = scrapy.Field()
    experience = scrapy.Field()
    description = scrapy.Field()
    skills = scrapy.Field()
    applyUrl = scrapy.Field()
    companyUrl = scrapy.Field()
    sourceWebsite = scrapy.Field()
    postedDate = scrapy.Field()
    scrapedAt = scrapy.Field()
