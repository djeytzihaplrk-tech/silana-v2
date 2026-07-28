/*
  Source: t.ms/IkyyExecutive
  RestApi: api.ikyyxd.my.id
  Note: Same ssvid.cc/convert1s.com backend as ytmp3.js, output switched to video.
  UNVERIFIED: response field names for video jobs are assumed to match the
  audio job shape — confirm downloadUrl/title/quality once tested live.
*/

import axios from 'axios'

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
const VALID_QUALITIES = ['360', '480', '720', '1080']
const DEFAULT_QUALITY = '480'

async function ytmp4(ytUrl, quality = DEFAULT_QUALITY) {
	const headers = {
		'accept': 'application/json',
		'content-type': 'application/json',
		'origin': 'https://ssvid.cc',
		'referer': 'https://ssvid.cc/',
		'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
	}

	const initRes = await axios.post('https://hub.convert1s.com/api/download', {
		url: ytUrl,
		video: { quality: `${quality}p` },
		output: { type: 'video', format: 'mp4' },
	}, { headers })

	const { statusUrl, title, duration } = initRes.data

	if (!statusUrl) {
		throw new Error('Failed to get statusUrl from server.')
	}

	let downloadData = null
	const maxAttempts = 40 // video jobs run longer than audio — ~60s ceiling
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
		quality: downloadData.quality || quality,
		downloadUrl: downloadData.downloadUrl,
	}
}

const handler = async (m, { conn, usedPrefix, command, args }) => {
	const url = args[0]
	const requestedQuality = (args[1] || '').replace(/p$/i, '')
	const quality = VALID_QUALITIES.includes(requestedQuality) ? requestedQuality : DEFAULT_QUALITY

	if (!url || !YT_REGEX.test(url)) {
		return conn.reply(m.chat,
			`🎬 *YouTube MP4 Downloader*\n\n` +
			`Downloads a YouTube video as an MP4 file.\n\n` +
			`*How to use:*\n` +
			`${usedPrefix}${command} <youtube link> [quality]\n\n` +
			`*Quality options:* ${VALID_QUALITIES.join(', ')} (default: ${DEFAULT_QUALITY}p)\n\n` +
			`*Example:*\n` +
			`${usedPrefix}${command} https://youtu.be/NJMEtaDTVtA 720\n\n` +
			`Supports youtube.com, youtu.be, YouTube Shorts, and live links.`,
			false, m
		)
	}

	try {
		await m.react('⏳')

		const result = await ytmp4(url, quality)

		await conn.sendMessage(m.chat, {
			video: { url: result.downloadUrl },
			mimetype: 'video/mp4',
			fileName: `${result.title || 'video'}.mp4`,
			caption: `🎬 ${result.title || 'Video'}\n📺 Quality: ${result.quality}p`,
		}, { quoted: m })

		await m.react('✅')
	} catch (e) {
		console.error('ytmp4 error:', e.message)
		await m.react('❌')
		m.reply(`Failed to download video: ${e.message}`)
	}
}

handler.help = handler.command = ['ytmp4']
handler.tags = ['downloader']
handler.limit = false

export default handler
			
