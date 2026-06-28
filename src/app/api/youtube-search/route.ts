import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "No query specified" }, { status: 400 });
    }

    // Search YouTube by fetching the results page
    // We add "הסבר" or "אלגוריתם" to find educational videos
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " אלגוריתם הסבר")}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch YouTube search results");
    }

    const html = await response.text();
    
    // Extract videoId using regex
    // YouTube HTML contains JSON with "videoId":"XXXXXXXXXXX"
    const videoIdMatch = html.match(/"videoId":"([^"]{11})"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    // Extract title
    let title = "סרטון הדרכה";
    if (videoId) {
      const titleMatch = html.match(new RegExp(`"videoId":"${videoId}".*?"title":\\{"runs":\\[\\{"text":"([^"]+)"\\}\\]\\}`));
      if (titleMatch) {
        title = titleMatch[1];
      }
    }

    if (videoId) {
      return NextResponse.json({ videoId, title });
    } else {
      return NextResponse.json({ error: "No video found" }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Error in youtube-search:", error);
    return NextResponse.json({ error: error.message || "Failed to search YouTube" }, { status: 500 });
  }
}
