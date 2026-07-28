import axios from "axios";
import * as cheerio from "cheerio";

class InstaSave {
  constructor() {
    this.types = ["media", "story", "dp"];
    this.client = axios.create({
      baseURL: "https://api.instasave.website",
      method: "POST",
      headers: {
        "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://instasave.website/",
        "Accept-Language": "id-ID",
        "sec-ch-ua-mobile": "?1",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        "sec-ch-ua-platform": '"Android"'
      }
    });
  }

  async req(url, data) {
    try {
      const res = await this.client({ url, data });
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  parse(html) {
    try {
      const clean = (html || "")
        .replace(/loader\['style'\]\['display'\]='none',document\['getElementById'\]\('div_download'\)\['innerHTML'\]='/g, "")
        .replace(/',document\['getElementById'\]\('downloader'\)\['remove'\]\(\),showAd\(\);/g, "")
        .replace(/\\x22/g, '"')
        .replace(/\\x20/g, " ");
      const $ = cheerio.load(clean);
      const results = $(".download-box .download-items")
        .map((_, el) => ({
          thumb: $(el).find(".download-items__thumb img").attr("src") || "",
          download: $(el).find(".download-items__btn a").attr("href") || ""
        }))
        .get();
      return { success: true, results };
    } catch (err) {
      return { success: false, message: err.message, results: [] };
    }
  }

  async download({ url, type = "media" }) {
    const target = url?.trim() || "";
    const actType = type.trim().toLowerCase();
    if (!this.types.includes(actType)) {
      return { success: false, message: `Invalid type: ${actType}`, valid_types: this.types };
    }
    if (!target) return { success: false, message: "URL empty." };

    const res = await this.req(`/${actType}`, `url=${encodeURIComponent(target)}&lang=en`);
    return res.success ? this.parse(res.data) : res;
  }
}

const igApi = new InstaSave();

// Detect the download type from the command name used (igdl / igstory / igdp)
const typeFromCommand = (cmd) => {
  if (cmd === "igstory") return "story";
  if (cmd === "igdp") return "dp";
  return "media";
};

let handler = async (m, { conn, args, command, usedPrefix }) => {
  const url = args[0];

  if (!url || !/instagram\.com/i.test(url)) {
    return conn.reply(
      m.chat,
      `📌 *Instagram Downloader*\n\n` +
      `Send an Instagram link to download it.\n\n` +
      `*Usage:*\n` +
      `${usedPrefix}ig <instagram post/reel url>\n` +
      `${usedPrefix}igstory <instagram story url>\n` +
      `${usedPrefix}instagram <instagram profile url>\n\n` +
      `*Example:*\n` +
      `${usedPrefix}ig https://www.instagram.com/reel/xxxxxxx/`,
      m
    );
  }

  await m.react("🕓");

  try {
    const type = typeFromCommand(command);
    const result = await igApi.download({ url, type });

    if (!result.success || !result.results?.length) {
      await m.react("✖️");
      return conn.reply(m.chat, "❌ Failed to fetch media. The link may be invalid, private, or unsupported.", m);
    }

    let sentAny = false;
    for (const item of result.results) {
      if (!item.download) continue;

      // Baileys fetching item.download directly often fails — these CDN
      // links require the same browser-like headers as the scrape request
      // (Referer, User-Agent), otherwise they return an error page instead
      // of the actual file, which shows up as a broken/blank attachment.
      let buffer, contentType;
      try {
        const fileRes = await axios.get(item.download, {
          responseType: "arraybuffer",
          timeout: 20000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
            Referer: "https://instasave.website/"
          }
        });
        buffer = Buffer.from(fileRes.data);
        contentType = fileRes.headers["content-type"] || "";
      } catch (fetchErr) {
        console.error("[IG] Failed to fetch media file:", fetchErr.message);
        continue;
      }

      const isVideo = contentType.includes("video") || /\.mp4(\?|$)/i.test(item.download);

      await conn.sendMessage(
        m.chat,
        isVideo
          ? { video: buffer, caption: "✅ Downloaded via Silana Bot" }
          : { image: buffer, caption: "✅ Downloaded via Silana Bot" },
        { quoted: m }
      );
      sentAny = true;
    }

    if (!sentAny) {
      await m.react("✖️");
      return conn.reply(m.chat, "❌ Media was found but couldn't be downloaded from the source. Try again later.", m);
    }

    await m.react("✅");
  } catch (err) {
    console.error("[IG Error]", err.message);
    await m.react("✖️");
    conn.reply(m.chat, `❌ An error occurred: ${err.message}`, m);
  }
};

handler.help = handler.command = ["instagram", "igstory", "ig"];
handler.tags = ["downloader"];
handler.limit = false;

export default handler;
  
