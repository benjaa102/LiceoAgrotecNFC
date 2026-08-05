import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Convierte la imagen desde la carpeta public a Base64
 */
async function getImageBase64(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not load ${url}`)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error fetching image:', error)
    return null
  }
}

/**
 * Exporta a Excel (.xlsx) con logos y estilos.
 */
export async function exportToExcel(rows, columns, filename, reportTitle = 'Reporte de Asistencia') {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Asistencia')

  // --- Cabecera Superior (Espacio para logos y título) ---
  worksheet.mergeCells('A1:J3')
  worksheet.getRow(1).height = 25
  worksheet.getRow(2).height = 25
  worksheet.getRow(3).height = 25
  
  const titleCell = worksheet.getCell('A1')
  titleCell.value = `${reportTitle}\nLiceo Agrotec`
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF124375' } } // Azul Agrotec aprox

  // Cargar Logos
  const agrotecBase64 = await getImageBase64('/logo_agrotec.png')
  const snaBase64 = await getImageBase64('/logo_sna.png')

  if (agrotecBase64) {
    const agrotecId = workbook.addImage({ base64: agrotecBase64, extension: 'png' })
    worksheet.addImage(agrotecId, {
      tl: { col: 0.1, row: 0.2 },
      ext: { width: 70, height: 90 }
    })
  }

  if (snaBase64) {
    const snaId = workbook.addImage({ base64: snaBase64, extension: 'png' })
    worksheet.addImage(snaId, {
      tl: { col: 8.5, row: 0.2 },
      ext: { width: 70, height: 90 }
    })
  }

  // --- Encabezados de tabla ---
  worksheet.getRow(5).values = columns.map(c => c.header)

  const headerRow = worksheet.getRow(5)
  headerRow.height = 25
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF86B52A' } // Verde SNA aprox
    }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    }
  })

  // --- Definir anchos de columna ---
  worksheet.columns = columns.map(c => ({
    key: c.key,
    width: c.width || 15
  }))

  // --- Llenar datos ---
  rows.forEach((row, index) => {
    const rowValues = columns.map(c => {
      // Allow custom formatting per column if needed, otherwise grab key
      return row[c.key]
    })
    const addedRow = worksheet.addRow(rowValues)
    
    // Bordes para las celdas de datos
    addedRow.eachCell(cell => {
      cell.border = {
        top: { style: 'hair' }, left: { style: 'hair' },
        bottom: { style: 'hair' }, right: { style: 'hair' }
      }
      cell.alignment = { vertical: 'middle' }
      if (cell.col >= 2) {
        // Centrar las columnas basado en la config, default a centrado para col > 1
        const align = columns[cell.col - 1]?.align || 'center'
        cell.alignment = { vertical: 'middle', horizontal: align }
      }
    })

    // Filas alternadas (Zebra stripes)
    if (index % 2 === 0) {
      addedRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      })
    }
  })

  // Autofiltro
  const lastColLetter = String.fromCharCode(64 + columns.length)
  worksheet.autoFilter = `A5:${lastColLetter}5`

  // Descargar el archivo
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  window.URL.revokeObjectURL(url)
}

/**
 * Exporta a PDF con jspdf y jspdf-autotable.
 */
export async function exportToPDF(rows, columns, filename, reportTitle = 'Reporte de Asistencia') {
  try {
    // Configurar para formato carta apaisado (landscape)
    const doc = new jsPDF({ orientation: 'landscape', format: 'letter' })
    
    // Cargar Logos
    const agrotecBase64 = await getImageBase64('/logo_agrotec.png')
    const snaBase64 = await getImageBase64('/logo_sna.png')

    if (agrotecBase64) {
      // x, y, width, height (medidas en mm)
      doc.addImage(agrotecBase64, 'PNG', 15, 10, 20, 25)
    }
    if (snaBase64) {
      doc.addImage(snaBase64, 'PNG', 240, 10, 20, 25)
    }

    // Títulos
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(18, 67, 117) // Azul Agrotec
    doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(100)
    doc.text('Liceo Agrotec', doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' })
    
    const fechaGeneracion = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })
    doc.setFontSize(9)
    doc.text(`Generado el: ${fechaGeneracion}`, doc.internal.pageSize.getWidth() / 2, 34, { align: 'center' })

    // Preparar tabla
    const tableColumn = columns.map(c => c.header)
    const tableRows = rows.map(r => columns.map(c => r[c.key]))

    const columnStylesObj = {}
    columns.forEach((c, i) => {
      columnStylesObj[i] = {}
      // Permitimos que jspdf-autotable calcule el ancho automáticamente,
      // solo forzamos alineación para mantener el diseño.
      if (c.align) columnStylesObj[i].halign = c.align
      else if (i > 0) columnStylesObj[i].halign = 'center'
    })

    // Dibujar tabla
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 42,
      theme: 'grid',
      headStyles: { 
        fillColor: [134, 181, 42], // Verde SNA
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: columnStylesObj,
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      }
    })

    doc.save(`${filename}.pdf`)
  } catch (error) {
    console.error("Error al exportar a PDF:", error)
    alert("Hubo un error al generar el PDF: " + error.message)
  }
}

/**
 * Exporta masivamente las fichas de asistencia de múltiples estudiantes a un solo PDF.
 */
export async function exportBulkFichasPDF(estudiantes, registrosComedor, registrosTransporte, month, year) {
  if (!estudiantes || estudiantes.length === 0) return

  try {
    const doc = new jsPDF()
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const datePrefix = `${year}-${String(month + 1).padStart(2, '0')}`

    let agrotecBase64 = null
    let snaBase64 = null
    try {
      agrotecBase64 = await getImageBase64('/logo-liceo.png') // Note: PerfilEstudiante used logo-liceo.png
    } catch (e) { }
    try {
      snaBase64 = await getImageBase64('/logo_sna.png')
    } catch (e) { }

    for (let i = 0; i < estudiantes.length; i++) {
      const est = estudiantes[i]

      // Si no es el primer estudiante, añadimos una página nueva
      if (i > 0) {
        doc.addPage()
      }

      // Dibujar logos
      if (agrotecBase64) doc.addImage(agrotecBase64, 'PNG', 14, 10, 20, 25)
      if (snaBase64) doc.addImage(snaBase64, 'PNG', 172, 10, 20, 25)

      doc.setFontSize(16)
      doc.setTextColor(40, 40, 40)
      doc.text('FICHA DE ASISTENCIA ESTUDIANTIL', 40, 20)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Liceo Bicentenario Agricola Tecnologico', 40, 26)
      doc.text('Fecha de Emision: ' + new Date().toLocaleDateString('es-CL'), 40, 32)
      
      doc.setLineWidth(0.5)
      doc.line(14, 40, 196, 40)

      // Info Estudiante
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('DATOS DEL ESTUDIANTE', 14, 50)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Nombre: ' + (est.nombre || ''), 14, 58)
      doc.text('RUT: ' + (est.rut || 'N/A'), 120, 58)
      doc.text('Curso: ' + (est.curso || 'N/A'), 14, 64)
      doc.text('Tipo: ' + (est.tipo || 'N/A'), 120, 64)
      
      doc.setLineWidth(0.2)
      doc.line(14, 70, 196, 70)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('REGISTROS DE ASISTENCIA - ' + monthNames[month] + ' ' + year, 14, 80)
      
      // Filtrar y combinar registros de este estudiante para el mes actual
      const combined = []
      registrosComedor
        .filter(r => r.id_estudiante === est.id && r.fecha?.startsWith(datePrefix))
        .forEach(r => combined.push({ ...r, _source: 'COMEDOR', _displayType: r.tipo_servicio }))
        
      registrosTransporte
        .filter(r => r.id_estudiante === est.id && r.fecha?.startsWith(datePrefix))
        .forEach(r => combined.push({ ...r, _source: 'TRANSPORTE', _displayType: r.tipo_registro }))

      // Ordenar por fecha y hora descendente
      combined.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora))

      const tableData = combined.map(r => [
        r.fecha || '',
        r.hora || '',
        r._source || '',
        r._displayType || '',
        r.estado || 'PRESENTE'
      ])

      autoTable(doc, {
        startY: 85,
        head: [['Fecha', 'Hora', 'Modulo', 'Servicio / Tipo', 'Estado']],
        body: tableData.length > 0 ? tableData : [['Sin registros', '', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 }
      })
    }

    const filename = `Fichas_Masivas_${monthNames[month]}_${year}.pdf`
    doc.save(filename)
  } catch (err) {
    console.error('Error generating bulk PDF:', err)
    alert('Error al generar el PDF masivo: ' + err.message)
  }
}
