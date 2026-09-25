import type { Metadata } from "next";
import Link from "next/link";
import { Church } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidad | Evangelicapp",
  description: "Cómo Evangelicapp y las iglesias que usan la plataforma tratan tus datos personales.",
};

const CONTACTO_EMAIL = "contacto@evangelicapp.cl";
const ULTIMA_ACTUALIZACION = "21 de agosto de 2026";

interface Seccion {
  id: string;
  titulo: string;
  contenido: React.ReactNode;
}

// Contenido redactado tomando como referencia la Ley N° 21.719 sobre
// Protección de Datos Personales (entra en vigencia el 1 de diciembre de
// 2026). No reemplaza la revisión de un equipo legal — en particular, la
// razón social y RUT del responsable/encargado y un eventual DPO quedan
// pendientes de completar antes de considerarse definitivo (mismo criterio
// que la nota de frontend/prompt.md sobre el consentimiento).
const SECCIONES: Seccion[] = [
  {
    id: "quienes-tratan-tus-datos",
    titulo: "1. Quiénes tratan tus datos",
    contenido: (
      <>
        <p>
          Evangelicapp es una plataforma de software que las iglesias evangélicas usan para administrar su propia
          congregación (agenda, finanzas, notas, registro de integrantes, entre otros).
        </p>
        <p>
          Cuando te registras como integrante de una iglesia —por ejemplo, al escanear el código QR que tu iglesia
          exhibe—, es esa iglesia quien decide qué datos recolectar y con qué fines los usa. Conforme a la Ley
          21.719, la iglesia es la <strong>responsable del tratamiento</strong> de tus datos personales. Evangelicapp
          provee la infraestructura técnica sobre la que la iglesia recolecta, almacena y administra esa información,
          actuando como <strong>encargada del tratamiento</strong> por cuenta y bajo instrucciones de cada iglesia.
        </p>
        <p>
          Para consultas sobre el funcionamiento técnico de la plataforma puedes escribirnos a{" "}
          <a href={`mailto:${CONTACTO_EMAIL}`} className="text-primary underline underline-offset-2 hover:no-underline">
            {CONTACTO_EMAIL}
          </a>
          . Para ejercer tus derechos sobre tus datos personales, dirígete en primer lugar a la iglesia de la que eres
          integrante: es ella quien administra tu información día a día.
        </p>
      </>
    ),
  },
  {
    id: "que-datos-recolectamos",
    titulo: "2. Qué datos personales recolectamos",
    contenido: (
      <>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Datos de identificación:</strong> nombre completo y RUN.</li>
          <li><strong>Datos de contacto:</strong> correo electrónico y teléfono.</li>
          <li>
            <strong>Datos de participación:</strong> fecha desde la que eres integrante de la iglesia y, cuando la
            iglesia lo registra, tu asistencia a actividades o eventos.
          </li>
          <li><strong>Fotografía (opcional):</strong> solo si decides subir una al registrarte.</li>
          <li>
            <strong>Datos de cuentas administrativas:</strong> si usas la plataforma con un rol de Pastor/a,
            Tesorero/a, Secretaría u otro rol de administración, además tratamos tu correo y tu contraseña
            (almacenada cifrada, nunca en texto plano) para autenticarte.
          </li>
        </ul>
        <p className="mt-3">
          No recolectamos datos sensibles como información de salud, orientación sexual o datos biométricos: tu
          fotografía se usa solo como identificación visual dentro del registro de integrantes, nunca se procesa con
          reconocimiento facial.
        </p>
      </>
    ),
  },
  {
    id: "para-que-los-usamos",
    titulo: "3. Para qué usamos tus datos",
    contenido: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Identificarte como integrante y mantener actualizado el registro de la congregación.</li>
        <li>Registrar tu asistencia a actividades o eventos cuando la iglesia lleva ese control.</li>
        <li>Permitir que la iglesia te contacte por correo o teléfono sobre asuntos de la congregación.</li>
        <li>Fines administrativos internos de la iglesia (agenda, finanzas, notas).</li>
      </ul>
    ),
  },
  {
    id: "consentimiento",
    titulo: "4. Tu consentimiento",
    contenido: (
      <p>
        Al marcar la casilla de consentimiento en el formulario de registro, otorgas un consentimiento libre,
        informado, específico y revocable para que la iglesia trate tus datos personales con los fines descritos en
        esta política. Puedes revocarlo en cualquier momento contactando a tu iglesia; la revocación no afecta la
        licitud del tratamiento realizado antes de ella.
      </p>
    ),
  },
  {
    id: "principios",
    titulo: "5. Principios que aplicamos",
    contenido: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><strong>Licitud y lealtad:</strong> tratamos tus datos con una base legal válida y de buena fe.</li>
        <li><strong>Finalidad:</strong> solo para los fines específicos descritos en esta política.</li>
        <li><strong>Proporcionalidad:</strong> pedimos únicamente los datos necesarios para esos fines.</li>
        <li><strong>Calidad:</strong> procuramos que tus datos estén exactos y actualizados.</li>
        <li><strong>Responsabilidad:</strong> podemos demostrar en cualquier momento que cumplimos esta política.</li>
        <li><strong>Seguridad:</strong> aplicamos medidas técnicas y organizativas para protegerlos.</li>
        <li><strong>Transparencia:</strong> te informamos con claridad cómo tratamos tus datos.</li>
        <li><strong>Confidencialidad:</strong> quienes acceden a tus datos están sujetos a deber de reserva.</li>
      </ul>
    ),
  },
  {
    id: "con-quien-compartimos",
    titulo: "6. Con quién compartimos tus datos",
    contenido: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Con el personal administrativo de tu propia iglesia (Pastor/a, Tesorero/a, Secretaría) habilitado para ver el registro de integrantes.</li>
        <li>Con proveedores de infraestructura técnica (hosting, almacenamiento de archivos) que hacen funcionar la plataforma, quienes actúan como encargados del tratamiento y están obligados contractualmente a proteger tus datos.</li>
        <li>Nunca con otras iglesias registradas en la plataforma: cada iglesia solo accede a los datos de sus propios integrantes.</li>
        <li>Nunca con fines publicitarios ni de venta de datos a terceros.</li>
      </ul>
    ),
  },
  {
    id: "transferencias-internacionales",
    titulo: "7. Transferencias internacionales",
    contenido: (
      <p>
        Si algún proveedor de infraestructura procesa datos fuera de Chile, exigimos que cuente con un nivel adecuado
        de protección de datos o con garantías equivalentes (por ejemplo, cláusulas contractuales tipo u otro
        mecanismo reconocido por la Ley 21.719).
      </p>
    ),
  },
  {
    id: "conservacion",
    titulo: "8. Cuánto tiempo conservamos tus datos",
    contenido: (
      <p>
        Mientras seas integrante activo de la iglesia y por el tiempo adicional necesario para cumplir obligaciones
        legales o resolver alguna disputa. Si dejas de ser integrante o solicitas la supresión de tus datos, la
        iglesia debe eliminarlos o anonimizarlos, salvo que exista una obligación legal que justifique conservarlos
        por más tiempo.
      </p>
    ),
  },
  {
    id: "seguridad",
    titulo: "9. Cómo protegemos tus datos",
    contenido: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Conexión cifrada (HTTPS) en toda la plataforma.</li>
        <li>Sesiones mediante cookies httpOnly (el token de sesión nunca queda expuesto al navegador) con protección contra ataques CSRF.</li>
        <li>Acceso restringido por rol: cada persona con acceso administrativo solo ve la información de su propia iglesia.</li>
        <li>Contraseñas almacenadas con algoritmos de hash, nunca en texto plano.</li>
      </ul>
    ),
  },
  {
    id: "tus-derechos",
    titulo: "10. Tus derechos sobre tus datos (derechos ARCO+)",
    contenido: (
      <>
        <p>La Ley 21.719 te reconoce estos derechos, personales, gratuitos e irrenunciables:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Acceso:</strong> saber qué datos tuyos tratamos y con qué finalidad.</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos o desactualizados.</li>
          <li><strong>Supresión:</strong> pedir la eliminación de tus datos cuando ya no sean necesarios o retires tu consentimiento.</li>
          <li><strong>Oposición:</strong> oponerte a un tratamiento concreto de tus datos.</li>
          <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
          <li><strong>Bloqueo temporal:</strong> suspender el tratamiento mientras se resuelve una solicitud.</li>
        </ul>
        <p className="mt-3">
          Puedes ejercerlos contactando directamente a tu iglesia, o escribiéndonos a{" "}
          <a href={`mailto:${CONTACTO_EMAIL}`} className="text-primary underline underline-offset-2 hover:no-underline">
            {CONTACTO_EMAIL}
          </a>{" "}
          si necesitas ayuda para ubicar el contacto correcto. La ley fija un plazo de respuesta de 30 días corridos
          (prorrogable una vez por otros 30), salvo el bloqueo temporal, que debe resolverse dentro de 2 días
          hábiles.
        </p>
      </>
    ),
  },
  {
    id: "reclamos",
    titulo: "11. Si no estás conforme con la respuesta",
    contenido: (
      <p>
        Puedes presentar un reclamo ante la Agencia de Protección de Datos Personales, el organismo autónomo creado
        por la Ley 21.719 para fiscalizar su cumplimiento, y en última instancia recurrir ante los tribunales de
        justicia.
      </p>
    ),
  },
  {
    id: "menores-de-edad",
    titulo: "12. Menores de edad",
    contenido: (
      <p>
        El formulario de registro no está diseñado para que menores de 14 años se inscriban sin la autorización de su
        madre, padre o tutor legal. Si detectas el registro de un menor sin esa autorización, contáctanos o
        contacta a la iglesia para que sus datos sean eliminados a la brevedad.
      </p>
    ),
  },
  {
    id: "cambios",
    titulo: "13. Cambios a esta política",
    contenido: (
      <p>
        Podemos actualizar esta política para reflejar cambios legales o de la plataforma. La fecha de la última
        actualización siempre queda indicada al inicio de esta página.
      </p>
    ),
  },
  {
    id: "contacto",
    titulo: "14. Contacto",
    contenido: (
      <p>
        Escríbenos a{" "}
        <a href={`mailto:${CONTACTO_EMAIL}`} className="text-primary underline underline-offset-2 hover:no-underline">
          {CONTACTO_EMAIL}
        </a>{" "}
        ante cualquier duda sobre esta política o sobre el tratamiento de tus datos en la plataforma.
      </p>
    ),
  },
];

export default function PoliticaPrivacidadPage() {
  return (
    <main className="min-h-screen bg-background">
      <div aria-hidden className="h-1.5 bg-[linear-gradient(90deg,hsl(199_70%_52%),hsl(203_66%_42%))]" />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Church className="h-3.5 w-3.5" />
          </div>
          <p className="font-display text-base italic text-primary">Evangelicapp</p>
        </Link>

        <h1 className="text-center font-display text-3xl italic text-primary">
          Política de Privacidad y Tratamiento de Datos Personales
        </h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Última actualización: {ULTIMA_ACTUALIZACION}. Redactada conforme a la Ley N° 21.719 sobre Protección de
          Datos Personales, que entra en vigencia en Chile el 1 de diciembre de 2026.
        </p>

        <nav aria-label="Índice" className="mt-8 rounded-xl border border-border bg-card p-5">
          <p className="mb-2 text-sm font-medium text-foreground">Contenido</p>
          <ol className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {SECCIONES.map((seccion) => (
              <li key={seccion.id}>
                <a href={`#${seccion.id}`} className="hover:text-primary hover:underline">
                  {seccion.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 space-y-10">
          {SECCIONES.map((seccion) => (
            <section key={seccion.id} id={seccion.id} className="scroll-mt-6">
              <h2 className="text-lg font-semibold text-foreground">{seccion.titulo}</h2>
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{seccion.contenido}</div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-center text-xs italic text-muted-foreground">
          Este documento fue redactado tomando como referencia la Ley 21.719. No reemplaza la revisión de un
          profesional legal antes de su uso definitivo.
        </p>
      </div>
    </main>
  );
}
