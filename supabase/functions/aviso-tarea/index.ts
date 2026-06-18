// =====================================================================
//  TT · Edge Function "aviso-tarea"
//  Envía un correo a los RESPONSABLES DIRECTOS de una tarea recién creada,
//  EXCLUYENDO al creador (nadie se manda correo a sí mismo). Se dispara con
//  un webhook en el INSERT de public.tareas.
//
//  Secrets (Supabase → Edge Functions → Secrets), NUNCA en el repo:
//    RESEND_API_KEY   clave de Resend (re_...)
//    FROM             remitente, p.ej. 'TT <notificaciones@attrapi.gob.mx>'
//                     (mientras no verifiques dominio: 'TT <onboarding@resend.dev>')
//    WEBHOOK_SECRET   (opcional) palabra secreta que el webhook manda en el header
//
//  Deploy:  supabase functions deploy aviso-tarea --no-verify-jwt
//  (o desde el panel: crear función "aviso-tarea", pegar esto y apagar Verify JWT)
// =====================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM           = Deno.env.get("FROM") ?? "TT <onboarding@resend.dev>";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// "Daniel, Mario , Daniel" -> ["Daniel","Mario"] (sin vacíos ni repetidos).
function nombresDe(s: string): string[] {
  return String(s || "").split(",").map((x) => x.trim()).filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}

// '2026-06-18' -> '18/06/2026'; permanente -> 'Permanente'.
function fmtFecha(rec: Record<string, unknown>): string {
  if (rec.permanente) return "Permanente";
  const f = String(rec.fecha ?? "").trim();
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (f || "—");
}

function rellenar(tpl: string, vars: Record<string, string>): string {
  return String(tpl).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

// Traduce nombres de personas -> sus correos (función SQL correos_de_personas).
async function rpcCorreos(nombres: string[]): Promise<{ nombre: string; email: string }[]> {
  if (!nombres.length) return [];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/correos_de_personas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ p_nombres: nombres }),
  });
  if (!r.ok) { console.error("rpc correos_de_personas:", await r.text()); return []; }
  return await r.json();
}

async function leerPlantilla(): Promise<{ asunto: string; cuerpo: string; activo: boolean } | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_correo?id=eq.1&select=asunto,cuerpo,activo`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) { console.error("leer plantilla:", await r.text()); return null; }
  const rows = await r.json();
  return rows[0] ?? null;
}

Deno.serve(async (req) => {
  try {
    // Si configuraste WEBHOOK_SECRET, el webhook debe mandarlo en este header.
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    const payload = await req.json();
    const rec = (payload && payload.record) ? payload.record : payload;
    if (!rec) return new Response("sin record", { status: 400 });

    const plantilla = await leerPlantilla();
    if (!plantilla || plantilla.activo === false) {
      return new Response("envio desactivado", { status: 200 });
    }

    const creador = String(rec.creado_por ?? "").trim();
    // Correos de los responsables, EXCLUYENDO al creador (por nombre).
    const destinatarios = (await rpcCorreos(nombresDe(String(rec.responsable ?? ""))))
      .filter((p) => p.nombre.trim() !== creador);
    if (!destinatarios.length) return new Response("sin destinatarios", { status: 200 });

    // Correo del creador -> "responder a" (si es usuario con correo).
    const creadorEmail = creador ? (await rpcCorreos([creador]))[0]?.email : undefined;

    const baseVars: Record<string, string> = {
      codigo: String(rec.codigo ?? ""),
      tema:   String(rec.tema ?? ""),
      fecha:  fmtFecha(rec),
      area:   String(rec.subdireccion ?? rec.area ?? ""),
      creador,
    };

    const enviados: string[] = [];
    for (const d of destinatarios) {
      const vars = { ...baseVars, responsable: d.nombre };
      const body: Record<string, unknown> = {
        from: FROM,
        to: [d.email],
        subject: rellenar(plantilla.asunto, vars),
        text: rellenar(plantilla.cuerpo, vars),
      };
      if (creadorEmail) body.reply_to = creadorEmail;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (r.ok) enviados.push(d.email);
      else console.error("resend ->", d.email, await r.text());
    }
    return new Response(JSON.stringify({ ok: true, enviados }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("aviso-tarea error:", e);
    return new Response("error: " + ((e as Error)?.message ?? e), { status: 500 });
  }
});
