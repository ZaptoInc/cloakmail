import type { Env } from "./types";

export interface CloudflareConfig {
  domain: string;
  domains: string[];
  defaultDomain: string;
  emailTtlSeconds: number;
  maxEmailSizeMb: number;
}

export function getDomains(env: Env): string[] {
  const domains = (env.DOMAINS || env.DOMAIN || "localhost")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(domains)];
}

export function getDefaultDomain(env: Env): string {
  const domains = getDomains(env);
  const configuredDefault = env.DEFAULT_DOMAIN?.trim().toLowerCase();

  return configuredDefault && domains.includes(configuredDefault)
    ? configuredDefault
    : domains[0];
}

export function getConfig(env: Env): CloudflareConfig {
  const domains = getDomains(env);

  return {
    domain: getDefaultDomain(env),
    domains,
    defaultDomain: getDefaultDomain(env),
    emailTtlSeconds: Number(env.EMAIL_TTL_SECONDS) || 86400,
    maxEmailSizeMb: Number(env.MAX_EMAIL_SIZE_MB) || 10,
  };
}