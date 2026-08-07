import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const OUTPUT_PATH = path.join(repoRoot, "assets", "committee-companies-data.js");
const DOMAIN_MAP_PATH = path.join(repoRoot, "data", "member-domain-map.json");
const GROUPS_IO_BASE_URL = (process.env.GROUPS_IO_BASE_URL || "https://lists.sync.global/api/v1").replace(/\/$/, "");
const GROUPS_IO_DIRECTORY_BASE_URL = (process.env.GROUPS_IO_DIRECTORY_BASE_URL || "https://groups.io/api/v1").replace(/\/$/, "");
const GROUPS_IO_PARENT_GROUP = process.env.GROUPS_IO_PARENT_GROUP || "globalSyncForum";

const API_KEY = process.env.GROUPS_IO_API_KEY
  || process.env.GROUPS_IO_TOKEN
  || process.env.GROUPS_IO
  || process.env.GROUPSIO;

const COMMITTEES = [
  {
    key: "faAccountability",
    label: "Featured Application Accountability Committee",
    group: "accountability"
  },
  {
    key: "svAccountability",
    label: "Super Validator Accountability Committee",
    group: "accountability"
  },
  {
    key: "marketing",
    label: "Marketing Committee",
    group: "Marketing"
  },
  {
    key: "tokenomics",
    label: "Tokenomics Committee",
    group: "tokenomics"
  },
  {
    key: "techOps",
    label: "Technology and Operations Committee",
    group: "tech-ops"
  },
  {
    key: "collateral",
    label: "Collateral Subcommittee",
    group: "collateral"
  }
];

function requireApiKey() {
  if (!API_KEY) {
    throw new Error("Missing Groups.io API key. Set GROUPS_IO_API_KEY, GROUPS_IO_TOKEN, GROUPS_IO, or GROUPSIO as a repository secret.");
  }
}

function normalizeDomain(domain) {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function extractEmail(member) {
  const candidates = [
    member.email,
    member.email_address,
    member.user_email,
    member?.user?.email
  ];

  return candidates.find((value) => typeof value === "string" && value.includes("@")) || "";
}

function domainFromEmail(email) {
  return normalizeDomain(email.split("@").pop());
}

function lookupCompany(email, domainMap, emailOverrides) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (normalizedEmail && emailOverrides[normalizedEmail]) {
    return emailOverrides[normalizedEmail];
  }

  const domain = domainFromEmail(normalizedEmail);
  if (!domain) {
    return "";
  }

  if (domainMap[domain]) {
    return domainMap[domain];
  }

  const parts = domain.split(".");
  for (let index = 1; index < parts.length - 1; index += 1) {
    const parentDomain = parts.slice(index).join(".");
    if (domainMap[parentDomain]) {
      return domainMap[parentDomain];
    }
  }

  return "";
}

function sortCompanies(companies) {
  return [...companies].sort((left, right) => left.localeCompare(right, "en", {
    sensitivity: "base",
    numeric: true
  }));
}

async function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function readJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must be valid JSON: ${error.message}`);
  }
}

function getMembersFromPayload(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.members)) {
    return payload.members;
  }

  if (Array.isArray(payload?.member_infos)) {
    return payload.member_infos;
  }

  return [];
}

function getListFromPayload(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.groups)) {
    return payload.groups;
  }

  return [];
}

function getGroupNameCandidates(groupName) {
  const candidates = [
    groupName,
    `${GROUPS_IO_PARENT_GROUP}+${groupName}`,
    `${groupName}@lists.sync.global`
  ];

  const lowerGroupName = groupName.toLowerCase();
  const lowerSubgroupCandidate = `${GROUPS_IO_PARENT_GROUP}+${lowerGroupName}`;
  if (!candidates.includes(lowerSubgroupCandidate)) {
    candidates.push(lowerSubgroupCandidate);
  }

  return candidates;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    let errorType = "";
    try {
      const errorPayload = JSON.parse(await response.text());
      errorType = errorPayload.type || "";
    } catch {
      errorType = "unknown_error";
    }

    const error = new Error(`Groups.io request failed: HTTP ${response.status} ${errorType}`);
    error.type = errorType;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function fetchGroupMembersForQuery(query) {
  const members = [];
  let pageToken = "";

  do {
    const url = new URL(`${GROUPS_IO_BASE_URL}/getmembers`);

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set("type", "members");
    url.searchParams.set("limit", "100");
    url.searchParams.set("sort_field", "email");
    url.searchParams.set("sort_dir", "asc");

    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    const payload = await fetchJson(url);
    members.push(...getMembersFromPayload(payload));

    pageToken = payload.has_more && payload.next_page_token
      ? String(payload.next_page_token)
      : "";
  } while (pageToken);

  return members;
}

async function fetchGroupMembersForName(groupName) {
  return fetchGroupMembersForQuery({ group_name: groupName });
}

async function fetchSubscribedGroups() {
  const groups = [];
  let pageToken = "";

  do {
    const url = new URL(`${GROUPS_IO_DIRECTORY_BASE_URL}/groups`);
    url.searchParams.set("limit", "100");

    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    const payload = await fetchJson(url);
    groups.push(...getListFromPayload(payload));

    pageToken = payload.has_more && payload.next_page_token
      ? String(payload.next_page_token)
      : "";
  } while (pageToken);

  return groups;
}

function valueLooksLikeGroup(value, groupName) {
  const normalizedValue = normalizeDomain(value).replace(/^https?:\/\//, "");
  const groupLower = groupName.toLowerCase();
  const candidates = getGroupNameCandidates(groupName).map((candidate) => candidate.toLowerCase());

  return candidates.some((candidate) => normalizedValue === candidate)
    || normalizedValue === `${groupLower}@lists.sync.global`
    || normalizedValue.includes(`/g/${groupLower}`)
    || normalizedValue.endsWith(`+${groupLower}`)
    || normalizedValue.endsWith(`/${groupLower}`);
}

function resolveGroupId(groups, groupName) {
  const match = groups.find((group) => {
    const values = [
      group.id,
      group.group_id,
      group.name,
      group.group_name,
      group.nice_group_name,
      group.email,
      group.url,
      group.website
    ];

    return values.some((value) => valueLooksLikeGroup(value, groupName));
  });

  return match?.id || match?.group_id || "";
}

async function fetchGroupMembers(groupName, getSubscribedGroups) {
  const errors = [];

  for (const candidate of getGroupNameCandidates(groupName)) {
    try {
      return await fetchGroupMembersForName(candidate);
    } catch (error) {
      errors.push(error.message);
      if (error.type !== "group_not_found") {
        throw error;
      }
    }
  }

  const subscribedGroups = await getSubscribedGroups();
  const groupId = resolveGroupId(subscribedGroups, groupName);
  if (groupId) {
    return await fetchGroupMembersForQuery({ group_id: String(groupId) });
  }

  throw new Error(errors.join("; "));
}

function assertNoEmails(output) {
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  if (emailPattern.test(output)) {
    throw new Error("Generated committee company data appears to contain an email address. Refusing to write public output.");
  }
}

async function main() {
  requireApiKey();

  const domainMap = await readJson(DOMAIN_MAP_PATH);
  const emailOverrides = readJsonEnv("COMMITTEE_EMAIL_TO_COMPANY_JSON");
  const committees = {};
  const groupCache = new Map();
  let subscribedGroupsPromise = null;
  const getSubscribedGroups = () => {
    if (!subscribedGroupsPromise) {
      subscribedGroupsPromise = fetchSubscribedGroups();
    }

    return subscribedGroupsPromise;
  };

  for (const committee of COMMITTEES) {
    if (!groupCache.has(committee.group)) {
      groupCache.set(committee.group, await fetchGroupMembers(committee.group, getSubscribedGroups));
    }

    const members = groupCache.get(committee.group);
    const companies = new Set();
    let matchedCount = 0;

    for (const member of members) {
      const company = lookupCompany(extractEmail(member), domainMap, emailOverrides);
      if (company) {
        companies.add(company);
        matchedCount += 1;
      }
    }

    committees[committee.key] = {
      label: committee.label,
      companies: sortCompanies(companies)
    };

    console.log(`${committee.label}: ${companies.size} companies matched from ${matchedCount} recognized subscriptions.`);
  }

  const data = {
    generatedAt: new Date().toISOString(),
    committees
  };

  const output = `window.COMMITTEE_COMPANIES_DATA = ${JSON.stringify(data, null, 2)};\n`;
  assertNoEmails(output);
  await fs.writeFile(OUTPUT_PATH, output, "utf8");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
