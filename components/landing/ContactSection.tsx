export default function ContactSection() {
  return (
    <section id="contacto" className="section-padding bg-background">
      <div className="container-custom">

        <div className="text-center" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-2" style={{ marginBottom: '0.5rem' }}>
            Hablamos?
          </h2>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            Te decimos en el dia si hay subvenciones para tu empresa.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 max-w-3xl mx-auto">

          {/* WhatsApp - Principal */}
          <a
            href="https://wa.me/34601646362?text=Hola%2C%20quiero%20saber%20qu%C3%A9%20subvenciones%20puedo%20conseguir"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[#25D366] shadow-sm p-6 text-center hover:shadow-md transition-shadow"
            style={{ background: '#25D366', textDecoration: 'none' }}
          >
            <div className="text-3xl mb-2">💬</div>
            <h3 className="text-lg font-bold text-white mb-1">WhatsApp</h3>
            <p className="text-sm text-white/80">Respuesta inmediata</p>
          </a>

          {/* Telefono */}
          <a
            href="tel:+34601646362"
            className="rounded-xl bg-[#f5f7fa] border border-[#e3e8ef] shadow-sm p-6 text-center hover:shadow-md transition-shadow"
            style={{ textDecoration: 'none' }}
          >
            <div className="text-3xl mb-2">📞</div>
            <h3 className="text-lg font-bold text-[#1a202c] mb-1">Llamanos</h3>
            <p className="text-sm text-[#6b7280]">601 64 63 62</p>
          </a>

          {/* Email */}
          <a
            href="mailto:admin@ayudapyme.es"
            className="rounded-xl bg-[#f5f7fa] border border-[#e3e8ef] shadow-sm p-6 text-center hover:shadow-md transition-shadow"
            style={{ textDecoration: 'none' }}
          >
            <div className="text-3xl mb-2">📧</div>
            <h3 className="text-lg font-bold text-[#1a202c] mb-1">Email</h3>
            <p className="text-sm text-[#6b7280]">admin@ayudapyme.es</p>
          </a>

        </div>

        <p className="text-center text-xs text-[#9ca3af] mt-6">
          Lunes a viernes, 10:00 - 19:00
        </p>
      </div>
    </section>
  );
}
