// A photo picked for a profile picture, made small before uploading: the middle square,
// shrunk to 256 x 256 (pictures are shown at most 88px wide, so this stays sharp on any
// screen) and saved as a JPEG of a few tens of KB.
const SIZE = 256

export async function avatarImage(file: File): Promise<string> {
  const bitmap = await loadImage(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Couldn’t read that photo.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Decodes the file, turned upright per its EXIF orientation (phone photos often need it).
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Older Safari: an <img> (which also applies the orientation).
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } catch {
      throw new Error('Couldn’t read that photo. Try a JPEG or PNG.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}
