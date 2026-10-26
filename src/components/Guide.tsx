const TIPS = [
  {
    icon: '🛢️',
    title: 'Aceite y filtro',
    text: 'Cada 5.000 a 10.000 km o 6 a 12 meses. Revisá el nivel una vez al mes, con el motor frío y en superficie plana. Si el aceite está negro o lechoso, andá al taller.',
  },
  {
    icon: '🛞',
    title: 'Llantas',
    text: 'Presión cada 2 semanas en frío (seguí la del manual o la etiqueta de la puerta). Rotación cada 10.000 km. Cambiá cuando el dibujo llegue a 1,6 mm o aparezcan grietas.',
  },
  {
    icon: '🛑',
    title: 'Frenos',
    text: 'Revisión cada 10.000 a 20.000 km. Señales de alerta: chirrido al frenar, pedal esponjoso, vibración o más distancia para detenerse. El líquido se cambia cada 1 a 2 años.',
  },
  {
    icon: '🔍',
    title: 'Revisión general',
    text: 'Cada 10.000 km o 12 meses: niveles, luces, correas, suspensión, escape y filtros. Es el chequeo que detecta problemas antes de que sean caros.',
  },
  {
    icon: '🔋',
    title: 'Batería',
    text: 'Dura entre 3 y 5 años. Mantené los terminales limpios y apretados. Si el arranque se siente lento o las luces bajan, hacela revisar.',
  },
  {
    icon: '🌡️',
    title: 'Refrigerante',
    text: 'Revisá el nivel con el motor frío. Nunca abras el depósito en caliente. Un nivel que baja seguido puede indicar una pérdida: no lo dejes pasar.',
  },
]

export function Guide() {
  return (
    <details className="guide card">
      <summary className="guide__summary">
        <span className="guide__icon" aria-hidden="true">
          📘
        </span>
        <span>
          <strong>Guía rápida de mantenimiento</strong>
          <span className="guide__hint">Qué revisar y cada cuánto</span>
        </span>
      </summary>
      <div className="guide__grid">
        {TIPS.map(tip => (
          <section key={tip.title} className="guide__item">
            <h3>
              <span aria-hidden="true">{tip.icon}</span> {tip.title}
            </h3>
            <p>{tip.text}</p>
          </section>
        ))}
      </div>
      <p className="guide__note">
        Los intervalos son orientativos. El manual del fabricante siempre manda, sobre todo si usás
        el carro en ciudad, con mucho tráfico, tierra o remolque.
      </p>
    </details>
  )
}
