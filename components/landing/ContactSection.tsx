export default function ContactSection() {
  return (
    <section id="contacto" className="section-padding bg-background">
      <div className="container-custom">

        <div className="text-center mb-12">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-4">
            Contacto
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            ¿Tienes dudas? Hablamos.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Cuéntanos tu caso y te decimos en el mismo día si hay subvenciones que encajan con tu empresa.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">

          <div className="rounded-2xl bg-[#f5f7fa] border border-[#e3e8ef] shadow-sm p-8 text-[#1a202c]">
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              Llámanos
            </h3>
            <p className="text-sm text-[#6b7280] mb-5">Lunes a viernes, 10:00 – 19:00 (hora peninsular)</p>
            <ul className="space-y-2 text-base font-semibold text-[#1a202c]">
              <li>
                <a href="tel:+34601646362" className="hover:text-primary transition-colors">
                  601 64 63 62
                </a>
              </li>
              <li>
                <a href="tel:+34611085921" className="hover:text-primary transition-colors">
                  611 08 59 21
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-[#f5f7fa] border border-[#e3e8ef] shadow-sm p-8 text-[#1a202c] flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                Escríbenos
              </h3>
              <p className="text-sm text-[#6b7280] mb-5">
                Respondemos en el mismo día laborable.
              </p>
              <a
                href="mailto:admin@ayudapyme.es"
                className="inline-flex items-center font-semibold text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                admin@ayudapyme.es
              </a>
            </div>
            <p className="mt-6 text-xs text-[#9ca3af] leading-relaxed">
              Cuanta más información nos des (sector, tamaño, ubicación), más rápido podemos decirte qué subvenciones tienes disponibles.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
