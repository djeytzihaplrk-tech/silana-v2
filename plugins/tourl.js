/*
# Feature : Photo to URL Uploader
# Type : ESM
# Url : https://phototourl.com
# Source : https://whatsapp.com/channel/0029Vb8SsEn4NViqwX3HaN0x
*/
import axios from "axios";
import FormData from "form-data";

async function uploadPhoto(buffer, filename = "image.jpg") {
  const form = new FormData();
  form.append("file", buffer, filename);

  const { data } = await axios.post(
    "https://phototourl.com/api/upload",
    form,
    {
      headers: {
        ...form.getHeaders(),
        Accept: "application/json",
        Origin: "https://phototourl.com",
        Referer: "https://phototourl.com/"
      }
    }
  );

  return data;
}

let handler = async (m, { conn }) => {
  // Get the quoted/replied message, or the message itself if it contains media
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || "";

  if (!mime || !mime.startsWith("image/")) {
    return conn.reply(
      m.chat,
      "❌ Please reply to an image with this command, or send an image with the caption *. tourl*.",
      m
    );
  }

  try {
    await conn.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

    // Download the image buffer from WhatsApp
    const buffer = await q.download();

    const result = await uploadPhoto(buffer, "image.jpg");

    if (!result || (!result.url && !result.data)) {
      throw new Error("Upload failed, no URL returned from server.");
    }

    const imageUrl = result.url || result.data?.url || JSON.stringify(result);

    await conn.reply(
      m.chat,
      `✅ *Photo uploaded successfully!*\n\n🔗 *URL:* ${imageUrl}`,
      m
    );

    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
  } catch (error) {
    console.error("[Upload2URL] Error:", error.message);
    await conn.reply(
      m.chat,
      `❌ Failed to upload photo.\n\nReason: ${error.message}`,
      m
    );
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
  }
};

handler.help = handler.command = ["tourl"];
handler.tags = ["tools"];
handler.limit = false;
export default handler;
