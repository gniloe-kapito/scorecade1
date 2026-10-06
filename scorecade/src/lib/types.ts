// Shared API types used by both server routes and the client SPA.

export interface GamePlatforms {
  windows: boolean;
  mac: boolean;
  linux: boolean;
}

export interface Screenshot {
  thumb: string;
  full: string;
}

/** Steam store category (multi-player, controller support, Remote Play, …).
 *  Descriptions arrive already localized (Russian). */
export interface GameCategory {
  id: number;
  description: string;
}

/** Minimum / recommended system requirements for Windows (sanitized HTML).
 *  Requirements for other OSes are intentionally not fetched — Windows only. */
export interface GameRequirements {
  minimum: string;
  recommended: string | null;
}

/** Ready-to-display price strings from Steam (already formatted, e.g. "$1.99"). */
export interface GamePrice {
  final: string;
  initial: string | null;
  discount: number;
}

/** Unified game format — the only shape the API ever returns to clients. */
export interface Game {
  id: string; // 'steam:730'
  name: string;
  cover: string; // vertical cover (falls back to header server-side)
  header: string; // horizontal capsule image
  released: string;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: GamePlatforms;
  metacritic: number | null;
  isFree: boolean;
  shortDescription: string;
  descriptionHtml: string; // sanitized
  screenshots: Screenshot[];
  storeUrl: string;
  // Extended details from appdetails:
  languages: string[]; // localized names, "*" marks full audio support
  categories: GameCategory[];
  recommendations: number | null; // Steam user review count
  achievements: number | null; // Steam achievement count
  price: GamePrice | null;
  requirements: GameRequirements | null; // Windows only
}

export interface SearchItem {
  id: string;
  name: string;
  cover: string;
  header: string;
  metascore: number | null;
}

export interface RatingRow {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  score: number;
  review: string | null;
  updatedAt: string; // ISO date string
}

export interface FeedItem extends RatingRow {
  username: string;
  avatarUrl: string | null;
}

export interface ProfileStats {
  count: number;
  average: number | null;
  distribution: number[]; // 11 numbers, index = score 0..10
}

export interface ProfileUser {
  username: string;
  createdAt: string; // ISO date string
  avatarUrl: string | null; // kappa.lol link
  bannerUrl: string | null; // kappa.lol link
  stats: ProfileStats;
  followers: number;
  following: number;
  wants: number; // «Хочу поиграть» count
  isFollowing: boolean | null; // null when not authenticated
}

export interface ProfileResponse {
  user: ProfileUser;
  ratings: RatingRow[];
  wants: WantRow[];
}

export interface AuthUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

export interface FriendRating {
  username: string;
  avatarUrl: string | null;
  score: number;
  review: string | null;
  updatedAt: string; // ISO date string
}

export interface CommunityStats {
  count: number;
  average: number | null;
  distribution: number[]; // 11 numbers, index = score 0..10
  wants: number; // how many users marked this game as «Хочу поиграть»
}

export interface CommunityRating {
  username: string;
  avatarUrl: string | null;
  score: number;
  review: string | null;
  updatedAt: string; // ISO date string
  isFriend: boolean; // viewer follows this user (false when anonymous)
}

export interface UserSearchItem {
  username: string;
  avatarUrl: string | null;
  ratings: number;
  followers: number;
  isFollowing: boolean | null; // null when not authenticated
  isMe: boolean;
}

/** Game status: 'played' (Играл) or 'want' (Хочу поиграть).
 *  Absence of a row means "Не играл" — the default state. */
export type GameStatusValue = "played" | "want";

export interface StatusRow {
  gameId: string;
  status: GameStatusValue;
  updatedAt: string; // ISO date string
}

/** A game the user marked as «Хочу поиграть». */
export interface WantRow {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  updatedAt: string; // ISO date string
}

export interface CommunityResponse {
  stats: CommunityStats;
  items: CommunityRating[];
  nextCursor: string | null;
}

export interface CommunityTopItem {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  count: number;
  average: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
