import Link from 'next/link';

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-light.png" alt="AyudaPyme logo" className="w-10 h-10 object-contain" />
              <span className="font-heading font-bold text-lg">AyudaPyme</span>
            </div>
            <p className="text-background/70 text-sm leading-relaxed">
              Tu agencia de subvenciones. Más dinero, menos preocupaciones. Simplificamos el papeleo para que tú te
              centres en lo importante.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/terminos" className="text-background/70 hover:text-background transition-colors text-sm">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/privacidad" className="text-background/70 hover:text-background transition-colors text-sm">
                  Política de privacidad
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Contacto</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li>admin@ayudapyme.es</li>
              <li>+34 601 64 63 62</li>
              <li>+34 611 08 59 21</li>
              <li>San Luis, Coruña</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-background/60 text-sm">© {year} AyudaPyme. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
