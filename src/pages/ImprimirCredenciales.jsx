import { useState, useEffect } from 'react'
import { Printer, Filter, Search, Download, CheckSquare, Square } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'

const CURSOS = ['7° Básico', '8° Básico', '1°A', '1°B', '1°C', '1°D', '2°A', '2°B', '2°C', '2°D', '3°A', '3°B', '3°C', '3°D', '4°A', '4°B', '4°C', '4°D']

export default function ImprimirCredenciales() {
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCurso, setFilterCurso] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('estudiantes').select('id, nombre, rut, curso, tipo, estado_autorizacion, matricula').order('curso').order('nombre')
      if (data) setEstudiantes(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = estudiantes.filter(e => {
    if (filterCurso && e.curso !== filterCurso) return false
    if (search) {
      const q = search.toLowerCase()
      const matchQ = e.nombre.toLowerCase().includes(q) || 
                     (e.rut && e.rut.toLowerCase().includes(q)) || 
                     (e.matricula && e.matricula.toLowerCase().includes(q))
      if (!matchQ) return false
    }
    return true
  })

  const handlePrint = () => {
    window.print()
  }

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAllFiltered = () => {
    if (selected.length === filtered.length) {
      setSelected([])
    } else {
      setSelected(filtered.map(e => e.id))
    }
  }

  const downloadSingleQR = (est) => {
    const svg = document.getElementById(`qr-${est.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${est.nombre.replace(/\\s+/g, '_')}_${est.rut}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  const downloadSelectedQR = async () => {
    const toDownload = filtered.filter(e => selected.length === 0 || selected.includes(e.id))
    for (let i = 0; i < Math.min(toDownload.length, 30); i++) {
      downloadSingleQR(toDownload[i])
      // Small delay to prevent browser freezing/blocking multiple downloads
      await new Promise(r => setTimeout(r, 300))
    }
    if (toDownload.length > 30) {
      alert("Por seguridad del navegador, solo se descargaron los primeros 30 QR. Selecciona en grupos más pequeños.")
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            <Printer size={24} style={{ color: 'var(--primary)' }} />
            Generador de Credenciales QR
          </h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Genera, descarga e imprime códigos QR masivos para credenciales
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input 
              className="input" 
              placeholder="Buscar por RUT, Nombre..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 220 }}
            />
          </div>
          <select className="input" value={filterCurso} onChange={e => setFilterCurso(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">Todos los cursos</option>
            {CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={downloadSelectedQR} title="Descarga las imágenes PNG de los seleccionados">
            <Download size={16} /> Descargar {selected.length > 0 ? selected.length : filtered.length}
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir {selected.length > 0 ? selected.length : filtered.length}
          </button>
        </div>
      </div>
      
      {!loading && (
        <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" onClick={selectAllFiltered}>
            {selected.length === filtered.length && filtered.length > 0 ? <CheckSquare size={16} style={{ color: 'var(--primary)' }} /> : <Square size={16} />}
            Seleccionar Todos
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {selected.length} seleccionados de {filtered.length} resultados. (Si no seleccionas ninguno, se imprimirán todos).
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando estudiantes...</div>
      ) : (
        <div className="print-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 20,
          marginTop: 20
        }}>
          {filtered.map(est => {
            const isActivo = est.estado_autorizacion === 'ACTIVO'
            const isSelected = selected.includes(est.id)
            const isPrintSelected = selected.length === 0 || isSelected
            
            return (
              <div key={est.id} className={`print-card ${isPrintSelected ? 'selected-for-print' : 'unselected-for-print'}`} style={{
                background: 'white',
                border: `2px solid ${isActivo ? '#10b981' : '#ef4444'}`,
                borderRadius: 12,
                padding: 16,
                textAlign: 'center',
                color: '#0f172a',
                pageBreakInside: 'avoid',
                boxShadow: isSelected ? '0 0 0 4px rgba(79, 142, 247, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }} onClick={() => toggleSelect(est.id)}>
                
                {/* Checkbox No Print */}
                <div className="no-print" style={{ position: 'absolute', top: 12, left: 12, color: isSelected ? 'var(--primary)' : '#cbd5e1' }}>
                  {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                
                {/* Download Btn No Print */}
                <button 
                  className="no-print" 
                  style={{ position: 'absolute', top: 8, right: 8, background: '#f1f5f9', border: 'none', borderRadius: '50%', padding: 6, cursor: 'pointer', color: '#64748b' }}
                  onClick={(e) => { e.stopPropagation(); downloadSingleQR(est); }}
                  title="Descargar PNG"
                >
                  <Download size={16} />
                </button>

                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 24px' }}>
                  {est.nombre}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, fontWeight: 600 }}>
                  {est.rut} • {est.curso}
                </div>
                
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, display: 'inline-block' }}>
                  <QRCodeSVG 
                    id={`qr-${est.id}`}
                    value={`${window.location.origin}/perfil/${est.id}`} 
                    size={120} 
                  />
                </div>
                
                <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: isActivo ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
                  Liceo Bicentenario Agrotecnológico
                </div>
              </div>
            )
          })}
          
          {filtered.length === 0 && (
            <div className="no-print" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              No se encontraron estudiantes en este curso.
            </div>
          )}
        </div>
      )}

      {/* Estilos adicionales solo para esta pantalla para manejar la grilla de impresión */}
      <style>{`
        @media print {
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 15px !important;
            margin: 0 !important;
          }
          .unselected-for-print {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
