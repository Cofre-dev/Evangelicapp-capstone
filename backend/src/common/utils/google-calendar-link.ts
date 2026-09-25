interface GoogleCalendarLinkParams {
  titulo: string;
  fechaInicio: Date;
  fechaFin: Date;
  descripcion?: string | null;
  ubicacion?: string | null;
}

/** UTC en formato YYYYMMDDTHHmmssZ, el que exige el parámetro `dates` de Google Calendar. */
function formatearFechaGoogleCalendar(fecha: Date): string {
  return fecha
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Arma el link público "agregar evento" de Google Calendar (sin OAuth — decisión
 * confirmada con el fundador). `URLSearchParams` se encarga del URL-encoding.
 */
export function buildGoogleCalendarLink(params: GoogleCalendarLinkParams): string {
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.titulo,
    dates: `${formatearFechaGoogleCalendar(params.fechaInicio)}/${formatearFechaGoogleCalendar(params.fechaFin)}`,
  });

  if (params.descripcion) {
    query.set('details', params.descripcion);
  }
  if (params.ubicacion) {
    query.set('location', params.ubicacion);
  }

  return `https://www.google.com/calendar/render?${query.toString()}`;
}
