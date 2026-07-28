// credits: rafli
// plugin by me 

import crypto from 'crypto'

const API = 'https://remusic.ai/api/v1/ai-music/music'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const freshGa = () =>
  `GA1.1.${Math.floor(Math.random() * 9e9 + 1e9)}.${Math.floor(Date.now() / 1000)}`

const randIP = () =>
  Array.from(
    { length: 4 },
    () => 1 + Math.floor(Math.random() * 254)
  ).join('.')

function headers() {
  return {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    origin: 'https://remusic.ai',
    referer: 'https://remusic.ai/ai-music-generator',
    'user-agent': UA,
    cookie: `_ga=${freshGa()}; anonymous_user_id=${crypto.randomUUID()}`,
    'x-forwarded-for': randIP()
  }
}

function pick(row) {
  return {
    id: row.song_id,
    title: row.title || 'Untitled',
    status: row.status,
    audio: row.audio_url || null,
    image: row.image_url || row.cover_url || null,
    duration: row.duration || null,
    tags: row.tags || null,
    lyrics: row.lyrics || null,
    description: row.description || null
  }
}

async function createJob(body, retries = 6) {
  let lastError = 'Unknown error'

  for (let i = 0; i < retries; i++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    })

    const json = await res.json().catch(() => null)

    if (
      json &&
      json.code === 100000 &&
      Array.isArray(json.data) &&
      json.data.length
    ) {
      return json.data
    }

    lastError = json
      ? `${json.code}: ${json.message}`
      : `HTTP ${res.status}`

    await sleep(600)
  }

  throw new Error(lastError)
}

async function pollJob(id, progress) {
  for (let i = 0; i < 70; i++) {
    await sleep(5000)

    const res = await fetch(`${API}/${id}`, {
      headers: headers()
    })

    const json = await res.json().catch(() => null)

    const row = Array.isArray(json?.data)
      ? json.data[0]
      : json?.data

    if (!row) continue

    progress?.(
      row.percentage ?? 0,
      row.status
    )

    if (
      row.status === 'success' &&
      row.audio_url
    ) {
      return row
    }

    if (
      ['failed', 'error', 'fail'].includes(
        row.status
      )
    ) {
      throw new Error('Generation failed.')
    }
  }

  throw new Error('Generation timed out.')
}

async function generateMusic(prompt, options = {}) {
  const {
    styles = [],
    title = null,
    lyrics = null,
    mv = 'v4',
    supplier = 10
  } = options

  const tags = Array.isArray(styles)
    ? styles.filter(Boolean).join(', ')
    : ''

  const custom = Boolean(title || lyrics)

  const body = custom
    ? {
        mode: 2,
        supplier,
        mv,
        is_instrumental: false,
        is_public: true,
        prompt: String(prompt || title),
        title: title || '',
        lyrics: lyrics || '',
        tags
      }
    : {
        mode: 1,
        supplier,
        mv,
        is_instrumental: false,
        is_public: true,
        prompt: tags
          ? `${prompt}, ${tags}`
          : String(prompt)
      }

  const jobs = await createJob(body)

  const songs = await Promise.all(
    jobs.map(job =>
      pollJob(job.song_id).then(pick)
    )
  )

  return {
    ok: songs.some(x => x.audio),
    songs
  }
}

let handler = async (m, { conn, text }) => {
  if (
    !text ||
    text === '--help' ||
    text === '-h'
  ) {
    return conn.reply(
      m.chat,
`🎵 *Remusic AI Generator*

Generate original music using AI directly from a text prompt.

━━━━━━━━━━━━━━

📌 Features

• AI-generated music
• Multiple music styles
• Album cover image
• Lyrics (if available)
• Audio download
• Multiple generated songs

━━━━━━━━━━━━━━

📖 Usage

.remusic <prompt>

Example

.remusic quiet night in the city

━━━━━━━━━━━━━━

You can also specify styles.

Example

.remusic quiet night|Jazz, Chill, Lo-fi

━━━━━━━━━━━━━━

Prompt Format

prompt|style1,style2,style3

Example

.remusic sunset on the beach|Reggae, Chill, Calm

━━━━━━━━━━━━━━

Need help?

.remusic --help`,
      m
    )
  }

  const [prompt, styleText = ''] = text
    .split('|')
    .map(v => v.trim())

  if (!prompt) {
    return conn.reply(
      m.chat,
      'Please provide a prompt.',
      m
    )
  }

  const styles = styleText
    ? styleText
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    : []

  await conn.reply(
    m.chat,
    '🎼 Creating your music...\n\nThis usually takes 30–90 seconds.',
    m
  )

  try {
    const result = await generateMusic(prompt, {
      styles
    })

    if (!result.ok) {
      return conn.reply(
        m.chat,
        'No music was generated.',
        m
      )
    }

    for (const song of result.songs) {
      if (!song.audio) continue

      const caption =
`🎵 AI Music Generated

Title:
${song.title}

Status:
${song.status}

Duration:
${song.duration || 'Unknown'}

Tags:
${song.tags || '-'}

Description:
${song.description || '-'}`

      if (song.image) {
        await conn.sendFile(
          m.chat,
          song.image,
          'cover.jpg',
          caption,
          m
        )
      } else {
        await conn.reply(
          m.chat,
          caption,
          m
        )
      }

      await conn.sendFile(
        m.chat,
        song.audio,
        `${song.title}.mp3`,
        null,
        m
      )
    }
  } catch (err) {
    conn.reply(
      m.chat,
      `❌ Error\n\n${err.message}`,
      m
    )
  }
}

handler.help = ['remusic']
handler.command = ['remusic']
handler.tags = ['ai']
handler.limit = false

export default handler
