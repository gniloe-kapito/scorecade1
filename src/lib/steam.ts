// The ONLY module that knows about Steam. Provider interface: search(q) / getGame(id).
// All requests go through the serialized queue with aggressive caching (spec §4).

import sanitizeHtml from "sanitize-html";
import { cached, createQueue } from "@/lib/cache";
import type {
  Game,
  GameRequirements,
  SearchItem,
} from "@/lib/types";

const STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/";
const STORE_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails/";
const CDN_BASE = "https://cdn.cloudflare.steamstatic.com/steam/apps";

const FETCH_TIMEOUT_MS = 9000;
const SEARCH_TTL = 24 * 60 * 60 * 1000; // 24h
const GAME_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days
const NEGATIVE_TTL = 24 * 60 * 60 * 1000; // cache `success:false` / non-games for 24h

const queue = createQueue(350);

export const verticalCoverUrl = (appid: number | string) =>
  `${CDN_BASE}/${appid}/library_600x900.jpg`;
export const headerCapsuleUrl = (appid: number | string) =>
  `${CDN_BASE}/${appid}/header.jpg`;

/** Allowed tags for game descriptions (spec §4.5). */
export function sanitizeGameHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em", "b", "i", "u", "s",
      "ul", "ol", "li", "h2", "h3", "a", "img",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["https"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer", target: "_blank" },
      }),
    },
    disallowedTagsMode: "discard",
  });
}

/** Stricter allowlist for system requirements lists (no links/images needed). */
function sanitizeRequirementsHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["br", "strong", "em", "b", "i", "u", "s", "ul", "ol", "li"],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

/** "английский<strong>*</strong>, русский, …<br><strong>*…озвучка…</strong>" → ["английский*", "русский", …].
 *  The part after <br> is Steam's footnote — everything before it is the language list. */
function parseLanguages(raw: string | undefined): string[] {
  if (!raw) return [];
  const listPart = raw.split("<br>")[0] ?? "";
  const text = listPart.replace(/<[^>]+>/g, "");
  return text
    .split(",")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0 && s !== "*")
    .slice(0, 40);
}

/** Requirements arrive as {minimum, recommended} or as an empty array when absent. */
function parseRequirements(
  raw: { minimum?: string; recommended?: string } | [] | undefined,
): GameRequirements | null {
  if (!raw || Array.isArray(raw)) return null;
  const minimum = typeof raw.minimum === "string" ? sanitizeRequirementsHtml(raw.minimum).trim() : "";
  if (!minimum) return null;
  const recommended =
    typeof raw.recommended === "string" && raw.recommended.trim().length > 0
      ? sanitizeRequirementsHtml(raw.recommended).trim()
      : null;
  return { minimum, recommended };
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      // 429 / 403 / 5xx from Steam — treat as upstream unavailability
      throw new Error(`Steam responded with ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function coverExists(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    return res.ok;
  } catch {
    return true; // assume it works; the client has onError fallbacks anyway
  } finally {
    clearTimeout(timer);
  }
}

interface StoreSearchResponse {
  total: number;
  items?: Array<{
    type: string;
    name: string;
    id: number;
    tiny_image: string;
    metascore?: string;
  }>;
}

/** Search games (max 10 results from Steam — enough for suggestions). */
export async function searchGames(term: string): Promise<SearchItem[]> {
  const key = `search:${term.trim().toLowerCase()}`;
  return cached(key, SEARCH_TTL, NEGATIVE_TTL, async () => {
    const url = `${STORE_SEARCH_URL}?term=${encodeURIComponent(term)}&l=russian&cc=us`;
    const data = await queue(() => fetchJson<StoreSearchResponse>(url));
    const items = data.items ?? [];
    return items
      .filter((it) => it.type === "app" && typeof it.id === "number")
      .map((it) => ({
        id: `steam:${it.id}`,
        name: it.name,
        cover: verticalCoverUrl(it.id),
        header: it.tiny_image ?? headerCapsuleUrl(it.id),
        metascore: it.metascore && /^\d+$/.test(it.metascore) ? Number(it.metascore) : null,
      }));
  });
}

interface AppDetailsResponse {
  [appid: string]: {
    success: boolean;
    data?: {
      steam_appid: number;
      name: string;
      type: string;
      is_free: boolean;
      short_description?: string;
      detailed_description?: string;
      about_the_game?: string;
      header_image?: string;
      developers?: string[];
      publishers?: string[];
      genres?: Array<{ id: string; description: string }>;
      platforms?: { windows: boolean; mac: boolean; linux: boolean };
      metacritic?: { score: number };
      release_date?: { coming_soon: boolean; date: string };
      screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>;
      // Extended details:
      supported_languages?: string; // HTML with <strong>*</strong> markers
      categories?: Array<{ id: number; description: string }>;
      recommendations?: { total: number };
      achievements?: { total: number };
      price_overview?: {
        currency: string;
        initial: number;
        final: number;
        discount_percent: number;
        initial_formatted?: string;
        final_formatted?: string;
      };
      pc_requirements?: { minimum?: string; recommended?: string } | [];
    };
  };
}

export function parseGameId(id: string): number | null {
  const match = /^steam:(\d{1,8})$/.exec(id);
  return match ? Number(match[1]) : null;
}

/** Full game details in the unified format. Returns null when not found / not a game. */
export async function getGame(id: string): Promise<Game | null> {
  const appid = parseGameId(id);
  if (!appid) return null;

  // v3 key — Windows-only requirements (mac/linux dropped per customer request)
  return cached(`game:${id}:v3`, GAME_TTL, NEGATIVE_TTL, async () => {
    const url = `${STORE_APPDETAILS_URL}?appids=${appid}&l=russian&cc=us`;
    const payload = await queue(() => fetchJson<AppDetailsResponse>(url));
    const entry = payload[String(appid)];
    if (!entry || !entry.success || !entry.data) return null; // negative-cached for 24h
    const d = entry.data;
    if (d.type !== "game") return null; // DLC / soundtracks / demos are not rateable

    // Prefer the pretty vertical cover; verify it exists, else fall back to header.
    const vertical = verticalCoverUrl(appid);
    const hasVertical = await coverExists(vertical);
    const header = d.header_image ?? headerCapsuleUrl(appid);

    const description = d.about_the_game || d.detailed_description || "";

    const price = d.price_overview
      ? {
          final: d.price_overview.final_formatted ?? `$${(d.price_overview.final / 100).toFixed(2)}`,
          initial:
            d.price_overview.discount_percent > 0 && d.price_overview.initial_formatted
              ? d.price_overview.initial_formatted
              : null,
          discount: d.price_overview.discount_percent ?? 0,
        }
      : null;

    return {
      id: `steam:${d.steam_appid}`,
      name: d.name,
      cover: hasVertical ? vertical : header,
      header,
      released: d.release_date?.date ?? "",
      developers: d.developers ?? [],
      publishers: d.publishers ?? [],
      genres: (d.genres ?? []).map((g) => g.description),
      platforms: {
        windows: !!d.platforms?.windows,
        mac: !!d.platforms?.mac,
        linux: !!d.platforms?.linux,
      },
      metacritic: typeof d.metacritic?.score === "number" ? d.metacritic.score : null,
      isFree: !!d.is_free,
      shortDescription: d.short_description ?? "",
      descriptionHtml: sanitizeGameHtml(description),
      screenshots: (d.screenshots ?? [])
        .slice(0, 12)
        .map((s) => ({ thumb: s.path_thumbnail, full: s.path_full })),
      storeUrl: `https://store.steampowered.com/app/${d.steam_appid}/`,
      // Extended details:
      languages: parseLanguages(d.supported_languages),
      categories: (d.categories ?? []).map((c) => ({ id: c.id, description: c.description })),
      recommendations:
        typeof d.recommendations?.total === "number" ? d.recommendations.total : null,
      achievements: typeof d.achievements?.total === "number" ? d.achievements.total : null,
      price,
      // Windows only — requirements for other OSes are not shown on the site.
      requirements: parseRequirements(d.pc_requirements),
    } satisfies Game;
  });
}

/** Curated popular games for the home page (details are cached 14 days each). */
const FEATURED_APPIDS = [
  730, 292030, 1174180, 367520, 1145360, 271590,
  620, 413150, 105600, 782330, 632470, 220,
];

export async function getFeaturedGames(): Promise<Game[]> {
  const games = await Promise.all(
    FEATURED_APPIDS.map((id) => getGame(`steam:${id}`)),
  );
  return games.filter((g): g is Game => g !== null);
}
