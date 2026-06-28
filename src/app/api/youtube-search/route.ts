import { NextResponse } from "next/server";

interface YouTubeResult {
  videoId: string;
  title: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractVideo(html: string): YouTubeResult | null {
  // YouTube HTML contains JSON with "videoId":"XXXXXXXXXXX"
  const videoIdMatch = html.match(/"videoId":"([^"]{11})"/);
  const videoId = videoIdMatch ? videoIdMatch[1] : null;
  if (!videoId) return null;

  let title = "סרטון הדרכה";
  const titleMatch = html.match(
    new RegExp(`"videoId":"${videoId}".*?"title":\\{"runs":\\[\\{"text":"([^"]+)"\\}\\]\\}`)
  );
  if (titleMatch) {
    title = titleMatch[1];
  }

  return { videoId, title };
}

async function searchYouTube(
  searchQuery: string,
  lang: "he" | "en"
): Promise<YouTubeResult | null> {
  // hl/gl bias the locale, lr restricts the results language
  const locale =
    lang === "he"
      ? { hl: "he", gl: "IL", lr: "lang_he", accept: "he-IL,he;q=0.9,en;q=0.6" }
      : { hl: "en", gl: "US", lr: "lang_en", accept: "en-US,en;q=0.9" };

  const searchUrl =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}` +
    `&hl=${locale.hl}&gl=${locale.gl}&lr=${locale.lr}`;

  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": locale.accept,
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  return extractVideo(html);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const concept: string = (body.query ?? body.selectedText ?? "").trim();
    const contextTitle: string = (body.contextTitle ?? "").trim();

    if (!concept && !contextTitle) {
      return NextResponse.json({ error: "No query specified" }, { status: 400 });
    }

    // Anchor the search in the general topic so ambiguous selected words
    // (e.g. "תבניות אימון") aren't misinterpreted out of context.
    const topic = contextTitle ? `${contextTitle} ` : "";
    const hebrewQuery = `${topic}${concept} הסבר`.trim();
    const englishQuery = `${topic}${concept} explained tutorial`.trim();

    // Prefer a Hebrew video; fall back to English only if none is found.
    const result =
      (await searchYouTube(hebrewQuery, "he")) ??
      (await searchYouTube(englishQuery, "en"));

    if (result) {
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "No video found" }, { status: 404 });
  } catch (error: any) {
    console.error("Error in youtube-search:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search YouTube" },
      { status: 500 }
    );
  }
}
