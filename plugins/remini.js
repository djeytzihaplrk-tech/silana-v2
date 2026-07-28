/*
# Feature : HD Image Enhancer
# Type : ESM
# Url : https://ihancer.com
# Source : https://whatsapp.com/channel/0029Vb7pLCF35fLqMBUCMP1D
*/
import axios from "axios";
import FormData from "form-data";

let handler = async (m, { conn }) => {
  const quoted = m.quoted ? m.quoted : m;
  const mime = (quoted.msg || quoted).mimetype || "";

  if (!/image/.test(mime)) {
    return conn.reply(
      m.chat,
      `⚠️ *Usage:*\n\nReply to an image, or send an image with the caption:\n${m.prefix || "."}${m.command || "remini"}`,
      m
    );
  }

  try {
    await conn.sendMessage(m.chat, { react: { text: "🖼️", key: m.key } });

    const buffer = await quoted.download();

    const form = new FormData();
    form.append("method", "1");
    form.append("is_pro_version", "false");
    form.append("is_enhancing_more", "false");
    form.append("max_image_size", "high");
    form.append("file", buffer, {
      filename: "image.jpg",
      contentType: "image/jpeg"
    });

    const response = await axios.post(
      "https://ihancer.com/api/enhance",
      form,
      {
        headers: form.getHeaders(),
        responseType: "arraybuffer"
      }
    );

    const result = Buffer.from(response.data);

    await conn.sendMessage(
      m.chat,
      {
        image: result,
        caption: `*HD Image Success* ✅\n\n🖼️ Your image has been enhanced to HD.`
      },
      { quoted: m }
    );

    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
  } catch (error) {
    console.error("HD Error:", error?.response?.data || error.message);

    await conn.sendMessage(
      m.chat,
      {
        text: `⚠️ Sorry, an error occurred while enhancing the image.\n\n💡 Error details:\n${error?.response?.data?.message || error.message}`
      },
      { quoted: m }
    );

    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
  }
};

handler.help = handler.command = ["remini"];
handler.tags = ["editor"];
handler.limit = false;

export default handler;
