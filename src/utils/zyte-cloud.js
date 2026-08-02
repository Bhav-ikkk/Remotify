import axios from "axios";

const JOBS_LIST_URL = "https://app.scrapinghub.com/api/jobs/list.json";
const ITEMS_BASE_URL = "https://storage.scrapinghub.com/items";

/**
 * Fetch the latest finished Scrapy Cloud job items for a spider.
 *
 * Auth: Zyte API key as Basic Auth username with an empty password.
 *
 * @param {string|number} projectId
 * @param {string} apiKey
 * @param {string} spiderName
 * @returns {Promise<object[]>}
 */
export async function fetchLatestZyteItems(projectId, apiKey, spiderName) {
  if (!projectId || !apiKey || !spiderName) {
    throw new Error(
      "fetchLatestZyteItems requires projectId, apiKey, and spiderName"
    );
  }

  const listResponse = await axios.get(JOBS_LIST_URL, {
    params: {
      project: projectId,
      spider: spiderName,
      state: "finished",
      count: 1,
    },
    auth: {
      username: apiKey,
      password: "",
    },
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const jobs = Array.isArray(listResponse.data?.jobs)
    ? listResponse.data.jobs
    : [];
  const latest = jobs[0];
  const jobId = latest?.id ?? latest?.key ?? null;

  if (!jobId) {
    throw new Error(
      `No finished Scrapy Cloud jobs found for spider "${spiderName}"`
    );
  }

  const itemsResponse = await axios.get(
    `${ITEMS_BASE_URL}/${jobId}?format=json`,
    {
      auth: {
        username: apiKey,
        password: "",
      },
      timeout: 60000,
      validateStatus: (status) => status >= 200 && status < 300,
    }
  );

  const items = itemsResponse.data;
  if (!Array.isArray(items)) {
    throw new Error(
      `Unexpected Zyte Storage payload for job ${jobId} (expected JSON array)`
    );
  }

  return items;
}
