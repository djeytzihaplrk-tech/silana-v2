/*
  Source: t.ms/IkyyExecutive
  RestApi: api.ikyyxd.my.id
  Note: Uses the ssvid.cc backend via convert1s.com — reasonably fast
*/

import axios from 'axios'

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/

async function ytmp3(ytUrl) {
	const headers = {
		'accept': 'application/json',
		'content-type': 'application/json',
		'origin': 'https://ssvid.cc',
		'referer': 'https://ssvid.cc/',
		'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
	}

	const initRes = await axios.post('https://hub.convert1s.com/api/download', {
		url: ytUrl,
		audio: { bitrate: '128k' },
		output: { type: 'audio', format: 'mp3' },
	}, { headers })

	const { statusUrl, title, duration } = initRes.data

	if (!statusUrl) {
		throw new Error('Failed to get statusUrl from server.')
	}

	let downloadData = null
	const maxAttempts = 20 // ~30s ceiling so a stuck job can't hang the handler forever
	let attempts = 0

	while (!downloadData) {
		if (++attempts > maxAttempts) {
			throw new Error('Conversion timed out, please try again.')
		}

		const statusRes = await axios.get(statusUrl, { headers })

		if (statusRes.data.status === 'completed') {
			downloadData = statusRes.data
		} else if (statusRes.data.status === 'error' || statusRes.data.status === 'failed') {
			throw new Error('Conversion failed on the server side.')
		} else {
			await new Promise(resolve => setTimeout(resolve, 1500))
		}
	}

	if (!downloadData.downloadUrl) {
		throw new Error('No downloadUrl returned by the server.')
	}

	return {
		title: downloadData.title || title,
		duration: downloadData.duration || duration,
		downloadUrl: downloadData.downloadUrl,
	}
}

const handler = async (m, { conn, usedPrefix, command, args }) => {
	const url = args[0]

	if (!url || !YT_REGEX.test(url)) {
		return conn.reply(m.chat,
			`📥 *YouTube MP3 Downloader*\n\n` +
			`Downloads the audio from a YouTube video as an MP3 file.\n\n` +
			`*How to use:*\n` +
			`${usedPrefix}${command} <youtube link>\n\n` +
			`*Example:*\n` +
			`${usedPrefix}${command} https://youtu.be/NJMEtaDTVtA\n\n` +
			`Supports youtube.com, youtu.be, YouTube Shorts, and live links.`,
			false, m
		)
	}

	try {
		await m.react('⏳')

		const result = await ytmp3(url)

		await conn.sendMessage(m.chat, {
			audio: { url: result.downloadUrl },
			mimetype: 'audio/mpeg',
			fileName: `${result.title || 'audio'}.mp3`,
			ptt: false,
		}, { quoted: m })

		await m.react('✅')
	} catch (e) {
		console.error('ytmp3 error:', e.message)
		await m.react('❌')
		m.reply(`Failed to download audio: ${e.message}`)
	}
}

handler.help = handler.command = ['ytmp3']
handler.tags = ['downloader']
handler.limit = false

export default handler
