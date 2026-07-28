const getChannelKey = (url) => {
    const match = url.match(/whatsapp\.com\/channel\/(.+)/);
    return match?.[1] || null;
};

const formatChannel = (data) => {
    const meta = data.thread_metadata || {};

    return `
📢 *CHANNEL INFO*

📛 Name: ${meta.name?.text || "-"}
🆔 ID: ${data.id || "-"}
🔗 Invite: ${meta.invite || "-"}
👥 Subscribers: ${meta.subscribers_count?.toLocaleString() || "0"}
🛡️ Verification: ${meta.verification || "Not Verified"}
📌 Status: ${data.state?.type || "-"}
📝 Description: ${meta.description?.text || "No description"}
⏱️ Created: ${
        meta.creation_time
            ? new Date(Number(meta.creation_time) * 1000).toLocaleString("en-US")
            : "-"
    }
`.trim();
};

let handler = async (m, {
    conn,
    args,
    usedPrefix,
    command
}) => {
    if (!args[0]) {
        return m.reply(
            `Please provide a WhatsApp Channel URL!\n\nExample:\n${usedPrefix + command} https://whatsapp.com/channel/0029Vaz5bJz3mFY2ccGBev1n`
        );
    }

    try {
        const channelId = getChannelKey(args[0]);

        if (!channelId) {
            return m.reply(
                "Invalid URL!\nPlease use the following format:\nhttps://whatsapp.com/channel/CHANNEL_ID"
            );
        }

        const result = await conn.newsletterMetadata(
            "invite",
            channelId
        );

        await conn.sendMessage(
            m.chat,
            {
                image: {
                    url: "https://cdn.phototourl.com/free/2026-07-28-65d65cff-ab5c-4590-84a8-01a0765467ad.jpg"
                },
                caption: formatChannel(result)
            },
            {
                quoted: m
            }
        );

    } catch (err) {
        console.error(err);
        m.reply(`Failed to retrieve channel information:\n${err.message || err}`);
    }
};

handler.command = ["stalkwa-channels"];

handler.help = ["stalkwa-channels"];

handler.tags = ["tools"];
export default handler;
