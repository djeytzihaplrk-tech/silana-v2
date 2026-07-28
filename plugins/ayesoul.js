// Import library if needed, for example:
import { WebSocket } from 'ws';

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  if (!text) throw `Please enter a question!\nExample: ${usedPrefix}${command} what are Nuclei tools`;

  await m.react('⏳');

  try {
    const result = await ayesoul(text);
    await conn.reply(m.chat, result, m);
    await m.react('✅');
  } catch (err) {
    console.error(err);
    await m.react('❌');
    m.reply(`❌ An error occurred: ${err.message || err}`);
  }
};

// Main function to communicate with AyeSoul via WebSocket
function ayesoul(prompt) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://soulgotov2.ayesoul.com');
    let responseText = '';

    ws.on('open', () => {
      const sessionDetails = {
        user_id: '',
        currentDateTimeISOString: new Date().toISOString(),
        dateObject: new Date(),
        isAnonymous: true,
        chin_tapak_dum_dum: {
          cf_config: {
            tapak_dum_dum: "lol"
          }
        }
      };

      ws.send(JSON.stringify({
        type: 'SOUL First Message',
        sessionDetails: sessionDetails
      }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'SOUL Query Message',
          message: {
            prompt: prompt,
            attachments: []
          },
          sessionDetails: sessionDetails
        }));
      }, 800);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'SOUL XStream') {
          responseText += msg.message || '';
        } else if (
          msg.type === 'SOUL XStream Finished' ||
          msg.type === 'final_answer_creator' ||
          msg.type === 'SOUL Answer Complete'
        ) {
          ws.close();
          resolve(responseText || msg.message || 'No response');
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    });

    ws.on('error', (err) => reject(err));

    ws.on('close', () => {
      if (responseText.length > 0) {
        resolve(responseText);
      } else {
        reject(new Error('No response from AyeSoul'));
      }
    });
  });
}

handler.help = ['ayesoul'];
handler.tags = ['ai'];
handler.command = /^(ayesoul)$/i;

export default handler;
