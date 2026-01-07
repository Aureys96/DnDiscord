/**
 * YouTube Service
 * Extracts audio URLs from YouTube videos using youtube-dl-exec
 */

import youtubedl from "youtube-dl-exec";

export interface YouTubeAudioInfo {
  audioUrl: string;
  title: string;
  duration: number; // seconds
  thumbnailUrl: string;
  expiresAt: number; // Unix timestamp
}

interface CacheEntry {
  info: YouTubeAudioInfo;
  fetchedAt: number;
}

// Cache audio URLs (they expire ~6 hours, we use 5.5h TTL)
const CACHE_TTL_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
const audioUrlCache = new Map<string, CacheEntry>();

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validate YouTube URL
 */
export function validateYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

/**
 * Get cached audio info if available and not expired
 */
function getCachedInfo(videoId: string): YouTubeAudioInfo | null {
  const cached = audioUrlCache.get(videoId);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.fetchedAt > CACHE_TTL_MS) {
    // Expired, remove from cache
    audioUrlCache.delete(videoId);
    return null;
  }

  // Check if the URL itself hasn't expired
  if (cached.info.expiresAt && now >= cached.info.expiresAt) {
    audioUrlCache.delete(videoId);
    return null;
  }

  return cached.info;
}

/**
 * Extract audio URL from YouTube video
 */
export async function extractAudioUrl(
  youtubeUrl: string,
): Promise<YouTubeAudioInfo> {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  // Check cache first
  const cached = getCachedInfo(videoId);
  if (cached) {
    console.log(`✓ Using cached audio URL for ${videoId}`);
    return cached;
  }

  console.log(`⏳ Extracting audio URL for ${videoId}...`);

  try {
    // Use youtube-dl-exec to get video info with audio URL
    const output = (await youtubedl(youtubeUrl, {
      dumpSingleJson: true,
      noPlaylist: true,
      format: "bestaudio",
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    })) as {
      url?: string;
      title?: string;
      duration?: number;
      thumbnail?: string;
      formats?: Array<{
        url: string;
        format_id: string;
        acodec: string;
        vcodec: string;
        ext: string;
      }>;
    };

    // Find the best audio format
    let audioUrl = output.url;

    if (!audioUrl && output.formats) {
      // Find audio-only format
      const audioFormat = output.formats.find(
        (f) =>
          f.acodec !== "none" &&
          (f.vcodec === "none" || f.ext === "m4a" || f.ext === "webm"),
      );

      if (audioFormat) {
        audioUrl = audioFormat.url;
      } else if (output.formats.length > 0) {
        // Fallback to first format
        audioUrl = output.formats[0].url;
      }
    }

    if (!audioUrl) {
      throw new Error("Could not extract audio URL");
    }

    const info: YouTubeAudioInfo = {
      audioUrl,
      title: output.title || "Unknown Title",
      duration: output.duration || 0,
      thumbnailUrl:
        output.thumbnail ||
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    // Cache the result
    audioUrlCache.set(videoId, {
      info,
      fetchedAt: Date.now(),
    });

    console.log(`✓ Extracted audio URL for "${info.title}" (${videoId})`);
    return info;
  } catch (error) {
    console.error(`✗ Failed to extract audio for ${videoId}:`, error);
    throw new Error(
      `Failed to extract audio: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get video info without extracting audio URL (faster)
 */
export async function getVideoInfo(youtubeUrl: string): Promise<{
  title: string;
  duration: number;
  thumbnailUrl: string;
}> {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  // Check if we have cached info
  const cached = getCachedInfo(videoId);
  if (cached) {
    return {
      title: cached.title,
      duration: cached.duration,
      thumbnailUrl: cached.thumbnailUrl,
    };
  }

  try {
    const output = (await youtubedl(youtubeUrl, {
      dumpSingleJson: true,
      noPlaylist: true,
      skipDownload: true,
      noCheckCertificates: true,
      noWarnings: true,
    })) as {
      title?: string;
      duration?: number;
      thumbnail?: string;
    };

    return {
      title: output.title || "Unknown Title",
      duration: output.duration || 0,
      thumbnailUrl:
        output.thumbnail ||
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  } catch (error) {
    console.error(`✗ Failed to get video info for ${videoId}:`, error);
    throw new Error(
      `Failed to get video info: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [videoId, entry] of audioUrlCache.entries()) {
    if (now - entry.fetchedAt > CACHE_TTL_MS) {
      audioUrlCache.delete(videoId);
    }
  }
}

/**
 * Clear all cache (for testing)
 */
export function clearCache(): void {
  audioUrlCache.clear();
}

// Periodically clear expired cache entries (every hour)
setInterval(clearExpiredCache, 60 * 60 * 1000);
