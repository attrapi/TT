// Genera las plantillas .xlsx con formato institucional. Se ejecuta una vez
// con `node generar-plantillas.js` desde esta carpeta. Requiere exceljs.
const ExcelJS = require('exceljs');

const COLORS = {
  SA:     { hex: 'FF5D4037', tenue: 'FFEFEBE9' },   // café
  SGOI:   { hex: 'FF166534', tenue: 'FFD1FAE5' },   // verde
  SPAC:   { hex: 'FF1E3A8A', tenue: 'FFDBEAFE' },   // azul
  ENLACE: { hex: 'FF6D28D9', tenue: 'FFEDE9FE' },   // morado
  GUINDA: { hex: 'FF691C32', tenue: 'FFF5EBED' },
};

const NOMBRE = {
  SA:     'Subdirección de Archivo',
  SGOI:   'Subdirección de Gestión de Obras Inducidas',
  SPAC:   'Subdirección de Procesos Administrativos de Construcción',
  ENLACE: 'Enlace administrativo del Director',
};

const FILAS = {
  SA: [
    ['SA-001', 'AMANDA', 'Transferencia primaria expediente 2024 obras inducidas', 'Subdirección de Archivo, Subdirección de Gestión de Obras Inducidas', 'Programa de transferencia con cronograma semanal y formato de inventario aprobado', 'Confirmar bodega de resguardo intermedio con Recursos Materiales', new Date(2026, 4, 15), 'En Proceso', 'https://drive.google.com/drive/folders/EJEMPLO'],
    ['SA-002', 'AMANDA', 'Inventario bodega central abril 2026', 'Subdirección de Archivo', 'Inventario físico verificado contra HSC', 'Subir reporte de cierre y archivar', new Date(2026, 4, 5), 'Atendida', ''],
    ['SA-003', 'AMANDA', 'Solicitud de baja documental ejercicios 2018-2019', 'Subdirección de Archivo, Coordinación Jurídica', 'Dictamen de valoración elaborado conforme LGA', 'Enviar dictamen a revisión jurídica', new Date(2026, 5, 30), 'En Proceso', ''],
  ],
  SGOI: [
    ['SGOI-001', 'FABIOLA', 'Reubicación líneas CFE km 42+300 Tramo II Querétaro-Irapuato', 'Subdirección de Gestión de Obras Inducidas, CFE, Coordinación Técnica', 'Convenio de coordinación firmado y proyecto ejecutivo aprobado', 'Liberar permisos municipales y ejecutar obra civil', new Date(2026, 5, 30), 'En Proceso', ''],
    ['SGOI-002', 'FABIOLA', 'Liberación derecho de vía Salinas Victoria NL', 'Subdirección de Gestión de Obras Inducidas, Coordinación Jurídica, Municipio Salinas Victoria', 'Avalúos de SAGARPA y INDAABIN concluidos', 'Notificar a propietarios y firmar convenios de pago', new Date(2026, 4, 30), 'En Proceso', ''],
    ['SGOI-006', 'FABIOLA', 'Reporte mensual obras inducidas abril 2026', 'Subdirección de Gestión de Obras Inducidas', 'Indicadores cerrados al 30 de abril', 'Entregar al Director y publicar en sitio interno', new Date(2026, 4, 7), 'Atendida', ''],
  ],
  SPAC: [
    ['SPAC-001', 'MARIO', 'Formalización contrato segmento 15A1 Saltillo-N. Laredo', 'Subdirección de Procesos Adm. de Construcción, Coordinación Jurídica', 'Anexos técnicos y económicos del contrato LO-09-D00-009D00999-I-3-2026 completos', 'Recabar firma del contratista y registrar en CompraNet', new Date(2026, 4, 10), 'En Proceso', ''],
    ['SPAC-002', 'MARIO', 'Acto de fallo segmento 15A2 Saltillo-N. Laredo', 'Subdirección de Procesos Adm. de Construcción, Comité de Adquisiciones, Notario Público', 'Evaluación técnica y económica concluidas; ganador identificado', 'Celebrar acto de fallo y publicar en CompraNet', new Date(2026, 3, 17), 'Atendida', ''],
    ['SPAC-007', 'MARIO', 'Informe semanal procedimientos en proceso', 'Subdirección de Procesos Adm. de Construcción', 'Reporte ejecutivo cerrado a las 17:00 del viernes', 'Entregar informe al Director Adrián Tavares', new Date(2026, 4, 7), 'En Proceso', ''],
  ],
  ENLACE: [
    ['ENLACE-001', 'SAMANTA', 'Compilación de acuerdos del Comité Directivo abril 2026', 'Enlace Director, Tres subdirecciones', 'Minuta circulada y validada por las tres subdirecciones', 'Dar seguimiento semanal a compromisos pendientes', new Date(2026, 4, 15), 'En Proceso', 'https://drive.google.com/drive/folders/EJEMPLO'],
    ['ENLACE-002', 'SAMANTA', 'Agenda de Director General mayo 2026', 'Enlace Director, Oficina del DG', 'Agenda confirmada con asistentes y materiales preparados', 'Coordinar logística de cada reunión', new Date(2026, 4, 7), 'En Proceso', ''],
    ['ENLACE-003', 'SAMANTA', 'Reporte ejecutivo cierre de abril 2026', 'Enlace Director, Tres subdirecciones', 'KPIs y pendientes consolidados de las tres subdirecciones', 'Presentar al Director Tavares en sesión semanal', new Date(2026, 3, 30), 'Atendida', ''],
  ],
};

function aplicarEstilos(ws, colorMain, colorTenue, columnas, frozenCols = 0, primeraColEsSubdireccion = false, tituloLargo = null) {
  // Anchos por columna
  ws.columns = columnas.map(c => ({ width: c.width, style: { font: { name: 'Calibri', size: 11 } } }));

  // Insertar título institucional en fila 1 (merged)
  ws.mergeCells(1, 1, 1, columnas.length);
  const titulo = ws.getCell(1, 1);
  titulo.value = 'ATTRAPI · TT — ' + (tituloLargo || ws.name || 'Plantilla');
  titulo.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titulo.alignment = { vertical: 'middle', horizontal: 'center' };
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GUINDA.hex } };
  ws.getRow(1).height = 28;

  // Subtítulo en fila 2 (descripción)
  ws.mergeCells(2, 1, 2, columnas.length);
  const sub = ws.getCell(2, 1);
  sub.value = 'Captura de tareas — Sistema de Gestión y Validación TT';
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6A6A6A' } };
  sub.alignment = { vertical: 'middle', horizontal: 'center' };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF7F2' } };
  ws.getRow(2).height = 18;

  // Encabezados en fila 3
  const encRow = ws.getRow(3);
  columnas.forEach((c, i) => {
    const cell = encRow.getCell(i + 1);
    cell.value = c.titulo;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMain } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'medium', color: { argb: colorMain } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });
  encRow.height = 32;

  // Bordes y zebra para 25 filas de datos
  const filaInicio = 4;
  const filaFin = filaInicio + 24;
  for (let r = filaInicio; r <= filaFin; r++) {
    const row = ws.getRow(r);
    row.height = 28;
    columnas.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: c.align || 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5DFD7' } },
        bottom: { style: 'thin', color: { argb: 'FFE5DFD7' } },
        left: { style: 'thin', color: { argb: 'FFE5DFD7' } },
        right: { style: 'thin', color: { argb: 'FFE5DFD7' } },
      };
      // Zebra en filas pares
      if ((r - filaInicio) % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF7F2' } };
      }
    });
  }

  // Validación de datos en columna Estatus
  const colEstatus = columnas.findIndex(c => c.titulo === 'Estatus') + 1;
  if (colEstatus > 0) {
    for (let r = filaInicio; r <= filaFin; r++) {
      ws.getCell(r, colEstatus).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"En Proceso,Atendida,Archivada"'],
        showErrorMessage: true,
        errorTitle: 'Estatus inválido',
        error: 'Selecciona En Proceso, Atendida o Archivada',
      };
    }
  }

  // Validación de Subdirección si es la consolidada
  if (primeraColEsSubdireccion) {
    for (let r = filaInicio; r <= filaFin; r++) {
      ws.getCell(r, 1).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"SA,SGOI,SPAC,ENLACE"'],
      };
    }
  }

  // Formato de fecha en columna Fecha de atención
  const colFecha = columnas.findIndex(c => c.titulo === 'Fecha de atención') + 1;
  if (colFecha > 0) {
    for (let r = filaInicio; r <= filaFin; r++) {
      ws.getCell(r, colFecha).numFmt = 'dd/mm/yyyy';
    }
  }

  // Pintar la celda del ID con el color de la sub (si aplica)
  if (!primeraColEsSubdireccion) {
    const colId = 1; // ID es la primera col
    for (let r = filaInicio; r <= filaFin; r++) {
      const cell = ws.getCell(r, colId);
      cell.font = { name: 'Consolas', size: 11, bold: true, color: { argb: colorMain } };
      cell.alignment = { vertical: 'top', horizontal: 'left' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorTenue } };
    }
  }

  // Congelar encabezado (fila 3) — al hacer scroll se queda visible
  ws.views = [{ state: 'frozen', xSplit: frozenCols, ySplit: 3 }];
  ws.pageSetup = {
    paperSize: 9, // Letter
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter = {
    oddHeader: '&L&"Calibri,Bold"&12 ATTRAPI · TT&R&"Calibri,Italic"&10 Sistema de Gestión TT',
    oddFooter: '&L&"Calibri,Italic"&9 ATTRAPI · Agencia de Trenes y Transporte Público Integrado&R&P de &N',
  };
}

const COL_BASE = [
  { titulo: 'ID',                     width: 14 },
  { titulo: 'Responsable',            width: 22 },
  { titulo: 'Tema',                   width: 38 },
  { titulo: 'Áreas involucradas',     width: 32 },
  { titulo: 'Acuerdos realizados',    width: 38 },
  { titulo: 'Acción a tomar',         width: 38 },
  { titulo: 'Fecha de atención',      width: 16, align: 'center' },
  { titulo: 'Estatus',                width: 14, align: 'center' },
  { titulo: 'URL',                    width: 32 },
];

const COL_CONS = [
  { titulo: 'Subdirección',           width: 14, align: 'center' },
  ...COL_BASE,
];

// Excel limita los nombres de hoja a 31 caracteres y prohíbe duplicados.
const NOMBRE_HOJA = {
  SA:     'SA · Archivo',
  SGOI:   'SGOI · Obras Inducidas',
  SPAC:   'SPAC · Procesos Adm.',
  ENLACE: 'Enlace del Director',
};

async function generarPlantillaSub(sub) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TT · ATTRAPI';
  wb.created = new Date();
  const ws = wb.addWorksheet(NOMBRE_HOJA[sub], { properties: { tabColor: { argb: COLORS[sub].hex } } });
  // Fila título y subtítulo + encabezado: 3 filas. Datos desde fila 4.

  const c = COLORS[sub];
  aplicarEstilos(ws, c.hex, c.tenue, COL_BASE, 0, false, NOMBRE[sub]);

  // Llenar filas de ejemplo
  FILAS[sub].forEach((fila, i) => {
    const row = ws.getRow(4 + i);
    fila.forEach((val, j) => row.getCell(j + 1).value = val);
  });

  // Llenar prefijo en filas vacías para guiar la captura
  const prefijo = sub + '-';
  for (let i = FILAS[sub].length; i < 25; i++) {
    const row = ws.getRow(4 + i);
    // Solo precargamos estatus en blanco para que no estorbe
  }

  const archivo = `Plantilla-TT-${sub === 'ENLACE' ? 'Enlace' : sub}.xlsx`;
  await wb.xlsx.writeFile(archivo);
  console.log('OK ' + archivo);
}

async function generarConsolidada() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TT · ATTRAPI';
  wb.created = new Date();
  const ws = wb.addWorksheet('Vista Consolidada', { properties: { tabColor: { argb: COLORS.GUINDA.hex } } });

  aplicarEstilos(ws, COLORS.GUINDA.hex, COLORS.GUINDA.tenue, COL_CONS, 0, true, 'Vista Consolidada · Cuatro Subdirecciones');

  // Llenar con todas las filas, agregando subdirección al frente
  let r = 4;
  ['SA', 'SGOI', 'SPAC', 'ENLACE'].forEach(sub => {
    FILAS[sub].forEach(fila => {
      const row = ws.getRow(r++);
      [sub, ...fila].forEach((val, j) => row.getCell(j + 1).value = val);
      // Pintar la celda Subdirección con su color
      const subCell = row.getCell(1);
      subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS[sub].hex } };
      subCell.alignment = { vertical: 'top', horizontal: 'center' };
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[sub].tenue } };
      // Y la celda ID también
      const idCell = row.getCell(2);
      idCell.font = { name: 'Consolas', size: 11, bold: true, color: { argb: COLORS[sub].hex } };
      idCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[sub].tenue } };
    });
  });

  await wb.xlsx.writeFile('Plantilla-TT-Consolidada.xlsx');
  console.log('OK Plantilla-TT-Consolidada.xlsx');
}

(async () => {
  try {
    await generarPlantillaSub('SA');
    await generarPlantillaSub('SGOI');
    await generarPlantillaSub('SPAC');
    await generarPlantillaSub('ENLACE');
    await generarConsolidada();
    console.log('\nTodas las plantillas generadas con formato.');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
