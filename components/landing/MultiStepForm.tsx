'use client';

import React, { useState } from 'react';
import { Building2, User, Users, Building, Factory, ArrowRight, ArrowLeft, Check, Sparkles, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';

type CompanySize = 'autonomo' | 'micro' | 'pequena' | 'mediana' | 'grande' | null;

interface FormData {
  actividad: string;
  cif_nif: string;
  email_facturacion: string;
  nombre_titular: string;
  domicilio_fiscal: string;
  codigo_postal: string;
  ciudad: string;
  telefono: string;
}

const NIF_MAP = 'TRWAGMYFPDXBNJZSQVHLCKE';

function normalizeId(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, '');
}

function isValidNIF(v: string): boolean {
  v = normalizeId(v);
  if (!/^[0-9]{8}[A-Z]$/.test(v)) return false;
  return v[8] === NIF_MAP[parseInt(v.slice(0, 8), 10) % 23];
}

function isValidNIE(v: string): boolean {
  v = normalizeId(v);
  if (!/^[XYZ][0-9]{7}[A-Z]$/.test(v)) return false;
  const map: Record<string, string> = { X: '0', Y: '1', Z: '2' };
  const numPart = map[v[0]] + v.slice(1, 8);
  return v[8] === NIF_MAP[parseInt(numPart, 10) % 23];
}

function sumDigits(n: number): number {
  return n < 10 ? n : Math.floor(n / 10) + (n % 10);
}

function isValidCIF(v: string): boolean {
  v = normalizeId(v);
  if (!/^[A-HJUVNPQRSWKLa-hjuvnpqrswkl][0-9]{7}[0-9A-Z]$/.test(v)) return false;
  const first = v[0].toUpperCase();
  const body = v.slice(1, 8);
  const control = v[8].toUpperCase();
  let sumEven = 0, sumOdd = 0;
  for (let i = 0; i < 7; i++) {
    const d = parseInt(body[i], 10);
    if ((i + 1) % 2 === 0) sumEven += d;
    else sumOdd += sumDigits(d * 2);
  }
  const digit = (10 - ((sumEven + sumOdd) % 10)) % 10;
  const letter = 'JABCDEFGHI'[digit];
  if ('ABEH'.includes(first)) return control === String(digit);
  if ('KPQSW'.includes(first)) return control === letter;
  return control === String(digit) || control === letter;
}

function isValidSpanishId(v: string): boolean {
  return isValidNIF(v) || isValidNIE(v) || isValidCIF(v);
}

function isValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

const companySizeOptions = [
  { value: 'autonomo' as const, label: 'Autónomo', icon: User },
  { value: 'micro' as const, label: 'Micro', sublabel: '1–9 empleados', icon: Users },
  { value: 'pequena' as const, label: 'Pequeña', sublabel: '10–49 empleados', icon: Building2 },
  { value: 'mediana' as const, label: 'Mediana', sublabel: '50–249 empleados', icon: Building },
  { value: 'grande' as const, label: 'Gran empresa', sublabel: '250+ empleados', icon: Factory },
];

const sizeLabels: Record<string, string> = {
  autonomo: 'Autónomo',
  micro: 'Micro (1–9 empleados)',
  pequena: 'Pequeña (10–49 empleados)',
  mediana: 'Mediana (50–249 empleados)',
  grande: 'Gran empresa (250+ empleados)',
};

const WEBHOOK_URL = 'https://ayudapyme.app.n8n.cloud/webhook/7c1626a4-96df-4d4b-ad2c-675afd64b257';

export default function MultiStepForm() {
  const [step, setStep] = useState(0);
  const [companySize, setCompanySize] = useState<CompanySize>(null);
  const [formData, setFormData] = useState<FormData>({
    actividad: '',
    cif_nif: '',
    email_facturacion: '',
    nombre_titular: '',
    domicilio_fiscal: '',
    codigo_postal: '',
    ciudad: '',
    telefono: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nifLookupEstado, setNifLookupEstado] = useState<'idle' | 'buscando' | 'ok' | 'no'>('idle');

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'cif_nif') setNifLookupEstado('idle');
  };

  async function buscarDatosEmpresa(nif: string) {
    if (!nif || nif.length < 8) return;
    setNifLookupEstado('buscando');
    try {
      const res = await fetch(`/api/clientes/lookup?nif=${encodeURIComponent(nif)}`);
      const data = await res.json();
      if (data.found) {
        setFormData(prev => ({
          ...prev,
          nombre_titular:   data.nombre_empresa ? (prev.nombre_titular || data.nombre_empresa) : prev.nombre_titular,
          domicilio_fiscal: data.ciudad && !prev.domicilio_fiscal ? '' : prev.domicilio_fiscal,
          codigo_postal:    data.codigo_postal || prev.codigo_postal,
          ciudad:           data.ciudad        || prev.ciudad,
        }));
        setNifLookupEstado('ok');
      } else {
        setNifLookupEstado('no');
      }
    } catch {
      setNifLookupEstado('idle');
    }
  }

  const next = () => { setStep((s) => s + 1); setErrorMessage(null); };
  const prev = () => { setStep((s) => s - 1); setErrorMessage(null); };

  const validateStep3 = (): string | null => {
    if (!formData.cif_nif.trim()) return 'La identificación es obligatoria.';
    if (!isValidSpanishId(formData.cif_nif)) return 'El NIF/NIE/CIF introducido no es válido.';
    if (!formData.email_facturacion.trim()) return 'El email de facturación es obligatorio.';
    if (!isValidEmail(formData.email_facturacion)) return 'Introduce un email de facturación válido.';
    if (!formData.nombre_titular.trim()) return 'El nombre del titular es obligatorio.';
    if (!formData.domicilio_fiscal.trim()) return 'El domicilio fiscal es obligatorio.';
    if (!formData.codigo_postal.trim()) return 'El código postal es obligatorio.';
    if (!/^[0-9]{4,6}$/.test(formData.codigo_postal.trim())) return 'Introduce un código postal válido.';
    if (!formData.ciudad.trim()) return 'La ciudad es obligatoria.';
    if (!formData.telefono.trim()) return 'El número de teléfono es obligatorio.';
    if (!termsAccepted) return 'Debes aceptar los términos y condiciones.';
    if (!companySize) return 'Selecciona el tamaño de tu empresa en el primer paso.';
    if (!formData.actividad.trim()) return 'Indica a qué se dedica tu empresa en el segundo paso.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validateStep3();
    if (err) { setErrorMessage(err); return; }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tamano_empresa: sizeLabels[companySize!],
          actividad: formData.actividad.trim(),
          cif_nif: normalizeId(formData.cif_nif),
          email_facturacion: formData.email_facturacion.trim(),
          nombre_titular: formData.nombre_titular.trim(),
          domicilio_fiscal: formData.domicilio_fiscal.trim(),
          codigo_postal: formData.codigo_postal.trim(),
          ciudad: formData.ciudad.trim(),
          telefono: formData.telefono.trim(),
          acepta_terminos: true,
          origen: 'entrevista-web',
        }),
      });
      if (!res.ok) throw new Error('Error al enviar datos.');
      setIsSubmitted(true);
      setStep(3);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Ha ocurrido un error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="formulario" className="section-padding bg-muted">
      <div className="container-custom">
        <div className="max-w-[650px] mx-auto">
          <form className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden" onSubmit={(e) => e.preventDefault()}>
            <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">

              {/* Step 0: pantalla de inicio */}
              {step === 0 && (
                <div className="animate-fade-in text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-4">
                    Descubre las Ayudas y Subvenciones para tu Empresa
                  </h2>
                  <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto">
                    Completa este formulario en pocos pasos y nuestro equipo se pondrá en contacto contigo.
                  </p>
                  <button type="button" onClick={() => setStep(1)} className="btn-primary text-lg px-10 py-4">
                    Comenzar <ArrowRight className="ml-2 w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Progress bar */}
              {step > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-center gap-3">
                    {[1, 2, 3].map((s) => (
                      <div key={s} className="flex items-center">
                        <div className={`step-indicator w-9 h-9 text-sm ${
                          isSubmitted ? 'completed' : step === s ? 'active' : step > s ? 'completed' : 'pending'
                        }`}>
                          {isSubmitted || step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                        {s < 3 && (
                          <div className={`w-10 md:w-16 h-1 mx-2 rounded-full transition-colors ${
                            isSubmitted || step > s ? 'bg-accent' : 'bg-muted'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center mt-3 text-xs">
                    <div className="flex items-center gap-3 md:gap-12">
                      {['Tamaño', 'Actividad', 'Datos'].map((label, i) => (
                        <span key={label} className={`w-12 md:w-16 text-center font-semibold ${
                          isSubmitted || step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'
                        }`}>{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Tamaño empresa */}
              {step === 1 && !isSubmitted && (
                <div className="animate-fade-in">
                  <h3 className="text-lg font-heading font-semibold text-foreground mb-5 text-center">
                    ¿Cuál es el tamaño de tu empresa?
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {companySizeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCompanySize(opt.value)}
                        className={`company-size-option p-4 ${companySize === opt.value ? 'selected' : ''}`}
                      >
                        <opt.icon className={`w-6 h-6 mb-2 transition-colors ${companySize === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-semibold text-foreground text-xs">{opt.label}</span>
                        {opt.sublabel && <span className="text-[10px] text-muted-foreground mt-1">{opt.sublabel}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end mt-6">
                    <button type="button" onClick={next} disabled={!companySize} className="btn-primary">
                      Siguiente <ArrowRight className="ml-2 w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Actividad */}
              {step === 2 && !isSubmitted && (
                <div className="animate-fade-in">
                  <h3 className="text-lg font-heading font-semibold text-foreground mb-5 text-center">
                    Actividad de tu empresa
                  </h3>
                  <div>
                    <label htmlFor="actividad" className="block text-sm font-medium text-foreground mb-2">
                      ¿A qué se dedica tu empresa?
                    </label>
                    <input
                      type="text"
                      id="actividad"
                      name="actividad"
                      value={formData.actividad}
                      onChange={handleInput}
                      placeholder="Ej: Consultoría tecnológica, Comercio minorista..."
                      className="input-field"
                    />
                  </div>
                  <div className="flex justify-between mt-6">
                    <button type="button" onClick={prev} className="btn-secondary">
                      <ArrowLeft className="mr-2 w-4 h-4" /> Anterior
                    </button>
                    <button type="button" onClick={next} disabled={!formData.actividad.trim()} className="btn-primary">
                      Siguiente <ArrowRight className="ml-2 w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Datos SEPA */}
              {step === 3 && !isSubmitted && (
                <div className="animate-fade-in">
                  <h3 className="text-lg font-heading font-semibold text-foreground mb-2 text-center">
                    Datos de contacto
                  </h3>
                  <p className="text-muted-foreground text-sm text-center mb-5">
                    Estos datos son necesarios para ponernos en contacto contigo.
                  </p>
                  <div className="space-y-4">
                    {/* NIF/CIF con autocomplete */}
                    <div>
                      <label htmlFor="cif_nif" className="block text-sm font-medium text-foreground mb-2">
                        Identificación (NIF/CIF/NIE) *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="cif_nif"
                          name="cif_nif"
                          value={formData.cif_nif}
                          onChange={handleInput}
                          onBlur={e => buscarDatosEmpresa(e.target.value.trim())}
                          placeholder="Ej: 12345678A, B12345678..."
                          className="input-field flex-1"
                          style={{ textTransform: 'uppercase' }}
                        />
                        <button
                          type="button"
                          onClick={() => buscarDatosEmpresa(formData.cif_nif.trim())}
                          disabled={nifLookupEstado === 'buscando' || formData.cif_nif.length < 8}
                          className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
                        >
                          {nifLookupEstado === 'buscando'
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando</>
                            : <><Search className="w-3.5 h-3.5" /> Buscar</>
                          }
                        </button>
                      </div>
                      {nifLookupEstado === 'ok' && (
                        <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Datos completados automáticamente
                        </p>
                      )}
                    </div>

                    {/* Resto de campos */}
                    {[
                      { id: 'email_facturacion', label: 'Email *', type: 'email', placeholder: 'tu@email.com' },
                      { id: 'nombre_titular', label: 'Nombre del responsable *', type: 'text', placeholder: 'Nombre completo' },
                      { id: 'telefono', label: 'Número de teléfono *', type: 'tel', placeholder: 'Ej: 600123456' },
                      { id: 'domicilio_fiscal', label: 'Domicilio fiscal *', type: 'text', placeholder: 'Calle, número, piso...' },
                    ].map((field) => (
                      <div key={field.id}>
                        <label htmlFor={field.id} className="block text-sm font-medium text-foreground mb-2">{field.label}</label>
                        <input
                          type={field.type}
                          id={field.id}
                          name={field.id}
                          value={formData[field.id as keyof FormData]}
                          onChange={handleInput}
                          placeholder={field.placeholder}
                          className="input-field"
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="codigo_postal" className="block text-sm font-medium text-foreground mb-2">Código postal *</label>
                        <input type="text" id="codigo_postal" name="codigo_postal" value={formData.codigo_postal} onChange={handleInput} placeholder="28001" className="input-field" />
                      </div>
                      <div>
                        <label htmlFor="ciudad" className="block text-sm font-medium text-foreground mb-2">Ciudad *</label>
                        <input type="text" id="ciudad" name="ciudad" value={formData.ciudad} onChange={handleInput} placeholder="Madrid" className="input-field" />
                      </div>
                    </div>
                    <div className="pt-3 border-t border-border">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-1 w-5 h-5 rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-muted-foreground">
                          He leído y acepto los{' '}
                          <Link href="/terminos" target="_blank" className="text-primary hover:underline font-medium">términos y condiciones</Link>
                          {' y '}
                          <Link href="/privacidad" target="_blank" className="text-primary hover:underline font-medium">la política de privacidad</Link>. *
                        </span>
                      </label>
                    </div>
                  </div>
                  {errorMessage && <p className="mt-4 text-sm text-destructive text-center">{errorMessage}</p>}
                  <div className="flex justify-between mt-6">
                    <button type="button" onClick={prev} className="btn-secondary">
                      <ArrowLeft className="mr-2 w-4 h-4" /> Anterior
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="btn-primary">
                      {isSubmitting ? 'Enviando...' : <>Enviar solicitud <Check className="ml-2 w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* Success */}
              {isSubmitted && (
                <div className="animate-fade-in text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/20 mb-6">
                    <Check className="w-8 h-8 text-accent" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-4">¡Formulario enviado!</h2>
                  <p className="text-foreground text-lg mb-2">Muy pronto nuestro equipo se pondrá en contacto contigo.</p>
                  <p className="text-muted-foreground text-base max-w-md mx-auto">
                    Gracias por confiar en nosotros. Revisaremos tu solicitud y te responderemos lo antes posible.
                  </p>
                </div>
              )}
            </div>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Tus datos están protegidos con encriptación SSL
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
