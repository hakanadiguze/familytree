// PDF export — captures the tree and exports as a single-page PDF.
// Finds the canvas element, temporarily resets its transform, captures,
// then restores. Chooses smallest paper size that fits content.

export async function exportTreeAsPdf(
  wrapEl: HTMLElement,
  people: { x: number; y: number }[],
  title: string
) {
  if (people.length === 0) throw new Error('No people to export')

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const padding = 100
  const minX = Math.min(...people.map(p => p.x)) - padding
  const minY = Math.min(...people.map(p => p.y)) - padding
  const maxX = Math.max(...people.map(p => p.x)) + padding
  const maxY = Math.max(...people.map(p => p.y)) + padding
  const contentW = Math.max(maxX - minX, 200)
  const contentH = Math.max(maxY - minY, 200)

  // Find the transformed canvas div
  const canvasDiv = wrapEl.querySelector('[data-tree-canvas]') as HTMLElement
  if (!canvasDiv) throw new Error('Canvas not found')

  // Temporarily reset transform so html2canvas can capture correctly
  const origTransform = canvasDiv.style.transform
  canvasDiv.style.transform = 'none'
  canvasDiv.style.transformOrigin = '0 0'

  // Small delay to let browser repaint
  await new Promise(r => setTimeout(r, 80))

  let captured: HTMLCanvasElement
  try {
    captured = await html2canvas(canvasDiv, {
      backgroundColor: '#f7f7f5',
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      x: Math.max(0, minX),
      y: Math.max(0, minY),
      width: contentW,
      height: contentH,
    })
  } finally {
    // Always restore transform
    canvasDiv.style.transform = origTransform
  }

  const imgData = captured.toDataURL('image/png')

  // Paper sizes landscape (mm)
  const papers = [
    { w: 297, h: 210 },   // A4
    { w: 420, h: 297 },   // A3
    { w: 594, h: 420 },   // A2
    { w: 841, h: 594 },   // A1
    { w: 1189, h: 841 },  // A0
  ]

  const MARGIN = 16  // mm margin on each side
  const PX_TO_MM = 25.4 / 96
  const contentWmm = contentW * PX_TO_MM
  const contentHmm = contentH * PX_TO_MM

  let chosenPaper = papers[papers.length - 1]
  for (const paper of papers) {
    if (contentWmm <= paper.w - MARGIN * 2 && contentHmm <= paper.h - MARGIN * 2) {
      chosenPaper = paper; break
    }
  }

  const availW = chosenPaper.w - MARGIN * 2
  const availH = chosenPaper.h - MARGIN * 2
  const scale  = Math.min(1, availW / contentWmm, availH / contentHmm)
  const finalW = contentWmm * scale
  const finalH = contentHmm * scale
  const offsetX = MARGIN + (availW - finalW) / 2
  const offsetY = MARGIN + (availH - finalH) / 2 + 6  // leave space for title

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [chosenPaper.w, chosenPaper.h],
  })

  // Title
  pdf.setFontSize(13)
  pdf.setTextColor(83, 74, 183)
  pdf.text(title, chosenPaper.w / 2, MARGIN - 4, { align: 'center' })

  // Tree image
  pdf.addImage(imgData, 'PNG', offsetX, offsetY, finalW, finalH)

  // Footer
  pdf.setFontSize(7)
  pdf.setTextColor(180, 180, 180)
  pdf.text('Developed for Yami • Family Tree App', chosenPaper.w / 2, chosenPaper.h - 4, { align: 'center' })

  pdf.save(`${title.replace(/[^\w\s-]/g, '').trim() || 'family_tree'}_tree.pdf`)
}
