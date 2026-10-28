/**
 * 读 WebM（Matroska）容器里的三样东西：时长、画面宽高。
 *
 * 为什么手写：录屏的「≤30 秒」「宽 ≤960」是页面上写在视频旁边的数字，也是路线图
 * 的硬约束 —— 它必须来自文件本身，而不是清单里另抄一份。能读这三样的库不少，
 * 但多一个依赖就多一个「读数随库版本变」的机会；EBML 的骨架就这几层，自己走一遍
 * 反而更容易说清「这个数字是从哪读出来的」。
 *
 * 只下沉到已知容器（Segment → Info / Tracks → TrackEntry → Video），其余元素按尺寸跳过。
 * 不处理「未知尺寸」（流式写入才用）：本仓的成品都由 ffmpeg 落盘，应当是可 seek 的。
 */
const ID = {
  SEGMENT: 0x18538067,
  INFO: 0x1549a966,
  TIMECODE_SCALE: 0x2ad7b1,
  DURATION: 0x4489,
  TRACKS: 0x1654ae6b,
  TRACK_ENTRY: 0xae,
  VIDEO: 0xe0,
  PIXEL_WIDTH: 0xb0,
  PIXEL_HEIGHT: 0xba,
}
const CONTAINERS = new Set([ID.SEGMENT, ID.INFO, ID.TRACKS, ID.TRACK_ENTRY, ID.VIDEO])

/** EBML 变长整数：`keepMarker` 为真时保留首字节里的长度标记（元素 ID 就是这么存的）。 */
function vint(buf, off, keepMarker) {
  const first = buf[off]
  if (first === undefined) return null
  let len = 1
  while (len <= 8 && !(first & (1 << (8 - len)))) len++
  if (len > 8) return null
  let value = keepMarker ? first : first & ((1 << (8 - len)) - 1)
  for (let i = 1; i < len; i++) {
    if (buf[off + i] === undefined) return null
    value = value * 256 + buf[off + i]
  }
  const unknown = !keepMarker && value === Math.pow(2, len * 7) - 1
  return { value, length: len, unknown }
}

function readUInt(buf, off, size) {
  let v = 0
  for (let i = 0; i < size; i++) v = v * 256 + buf[off + i]
  return v
}

function readFloat(buf, off, size) {
  if (size === 4) return buf.readFloatBE(off)
  if (size === 8) return buf.readDoubleBE(off)
  return null
}

function walk(buf, start, end, found) {
  let off = start
  while (off < end) {
    const id = vint(buf, off, true)
    if (!id) break
    const size = vint(buf, off + id.length, false)
    if (!size || size.unknown) break
    const bodyOff = off + id.length + size.length
    const bodyEnd = Math.min(bodyOff + size.value, end)

    if (CONTAINERS.has(id.value)) walk(buf, bodyOff, bodyEnd, found)
    else if (id.value === ID.DURATION) found.duration = readFloat(buf, bodyOff, size.value)
    else if (id.value === ID.TIMECODE_SCALE) found.timecodeScale = readUInt(buf, bodyOff, size.value)
    else if (id.value === ID.PIXEL_WIDTH) found.width = readUInt(buf, bodyOff, size.value)
    else if (id.value === ID.PIXEL_HEIGHT) found.height = readUInt(buf, bodyOff, size.value)

    off = bodyEnd
  }
  return found
}

/** 返回 { durationMs, width, height }；读不到的字段是 undefined（调用方自行断言）。 */
export function readWebmMeta(buf) {
  const found = walk(buf, 0, buf.length, {})
  const scale = found.timecodeScale || 1000000 // EBML 默认 1 毫秒/单位
  return {
    durationMs: found.duration ? Math.round((found.duration * scale) / 1000000) : undefined,
    width: found.width,
    height: found.height,
  }
}
