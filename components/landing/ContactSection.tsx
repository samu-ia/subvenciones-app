export default function ContactSection() {
  return (
    <section id="contacto" className="section-padding bg-background">
      <div className="container-custom">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Contacta con nosotros</h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Si tienes dudas sobre las subvenciones, el proceso o quieres que revisemos tu caso, escríbenos o solicita
            una llamada.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl bg-[#f5f7fa] border border-[#e3e8ef] shadow p-8 text-[#1a202c]">
            <h3 className="text-2xl font-bold mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              Horario de llamadas
            </h3>
            <p className="text-sm text-[#4b5563] mb-2">(hora peninsular española):</p>
            <ul className="space-y-1 text-base font-medium">
              <li>
                Lunes a viernes: 10:00 – 19:00{' '}
                <span className="ml-2 font-semibold text-primary">601 64 63 62</span>
              </li>
              <li>
                Lunes a viernes: 11:00 – 19:00{' '}
                <span className="ml-2 font-semibold text-primary">611 08 59 21</span>
              </li>
            </ul>
            <p className="mt-4 text-sm text-[#6b7280]">
              Indica tu disponibilidad en el formulario y ajustaremos la llamada lo máximo posible.
            </p>
          </div>

          <div className="rounded-2xl bg-[#f5f7fa] border border-[#e3e8ef] shadow p-8 flex flex-col justify-between text-[#1a202c]">
            <div>
              <h3 className="text-2xl font-bold mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                Correo electrónico
              </h3>
              <p className="text-sm text-[#4b5563] mb-4">Si lo prefieres, puedes escribirnos directamente.</p>
              <a
                href="mailto:admin@ayudapyme.es"
                className="inline-flex items-center font-semibold underline underline-offset-4 hover:text-primary"
              >
                admin@ayudapyme.es
              </a>
            </div>
            <p className="mt-6 text-xs text-[#6b7280]">
              Cuanta más información (sector, tamaño, ubicación), más precisa será la respuesta.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
