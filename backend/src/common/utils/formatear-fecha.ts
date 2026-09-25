/** Formato largo en español usado en el cuerpo y pie de los certificados de ceremonias. */
export function formatearFechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}
