import { formatNumber, KM_PER_MILE } from '../maintenance'
import type { DistanceUnit, VehicleType } from '../types'

type Tip = {
  icon: string
  title: string
  text: string
}

/** Redondea una distancia canónica a un número lindo para la guía. */
function niceDistance(km: number, unit: DistanceUnit): string {
  if (unit === 'km') return `${formatNumber(km)} km`
  const miles = km / KM_PER_MILE
  const step = km < 1000 ? 100 : km < 10000 ? 500 : 1000
  const rounded = Math.max(step, Math.round(miles / step) * step)
  return `${formatNumber(rounded)} mi`
}

function distanceRange(minKm: number, maxKm: number, unit: DistanceUnit): string {
  return `${niceDistance(minKm, unit)} a ${niceDistance(maxKm, unit)}`
}

function carTips(unit: DistanceUnit): Tip[] {
  return [
    {
      icon: '🛢️',
      title: 'Aceite y filtro',
      text: `Cada ${distanceRange(5000, 10000, unit)} o 6 a 12 meses. Revisá el nivel una vez al mes, con el motor frío y en superficie plana. Si el aceite está negro o lechoso, andá al taller.`,
    },
    {
      icon: '🛞',
      title: 'Llantas',
      text: `Presión cada 2 semanas en frío (seguí la del manual o la etiqueta de la puerta). Rotación cada ${niceDistance(10000, unit)}. Cambiá cuando el dibujo llegue a 1,6 mm o aparezcan grietas.`,
    },
    {
      icon: '🛑',
      title: 'Frenos',
      text: `Revisión cada ${distanceRange(10000, 20000, unit)}. Señales de alerta: chirrido al frenar, pedal esponjoso, vibración o más distancia para detenerse. El líquido se cambia cada 1 a 2 años.`,
    },
    {
      icon: '🔍',
      title: 'Revisión general',
      text: `Cada ${niceDistance(10000, unit)} o 12 meses: niveles, luces, correas, suspensión, escape y filtros. Es el chequeo que detecta problemas antes de que sean caros.`,
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
}

function motorcycleTips(unit: DistanceUnit): Tip[] {
  return [
    {
      icon: '🛢️',
      title: 'Aceite y filtro',
      text: `Cada ${distanceRange(3000, 5000, unit)} o 6 meses. Revisá el nivel seguido, con la moto derecha y el motor frío. Si el aceite está negro, lechoso o huele a combustible, andá al taller.`,
    },
    {
      icon: '⛓️',
      title: 'Cadena o correa',
      text: `Lubricá y revisá la tensión cada ${distanceRange(500, 1000, unit)} o después de andar con lluvia. Si es scooter con correa, revisá la correa y los rodillos según el manual.`,
    },
    {
      icon: '🛞',
      title: 'Llantas',
      text: 'Presión cada 2 semanas en frío. Revisá dibujo, grietas y desgaste irregular. Una llanta gastada o con poca presión cambia mucho el agarre en curva y al frenar.',
    },
    {
      icon: '🛑',
      title: 'Frenos',
      text: `Revisión cada ${distanceRange(10000, 20000, unit)}. Revisá pastillas, discos, líquido y también el freno trasero. Si el freno se siente blando o largo, no sigas andando.`,
    },
    {
      icon: '🎛️',
      title: 'Cables y controles',
      text: 'Revisá cables de acelerador, embrague y freno; que no estén secos, cortados ni trabados. Lubricá y ajustá según el manual. Un cable que se rompe en marcha es peligroso.',
    },
    {
      icon: '🌡️',
      title: 'Refrigerante o aire',
      text: 'Si es refrigerada por líquido, revisá el nivel con el motor frío y nunca abras el depósito en caliente. Si es enfriada por aire, mantené limpias las aletas del motor.',
    },
    {
      icon: '🔋',
      title: 'Batería',
      text: 'Dura entre 3 y 5 años. Mantené los terminales limpios y apretados. Si el arranque se siente lento o las luces bajan, hacela revisar.',
    },
  ]
}

type Props = {
  vehicleType: VehicleType
  distanceUnit: DistanceUnit
}

export function Guide({ vehicleType, distanceUnit }: Props) {
  const tips = vehicleType === 'motorcycle' ? motorcycleTips(distanceUnit) : carTips(distanceUnit)

  return (
    <details className="guide card">
      <summary className="guide__summary">
        <span className="guide__icon" aria-hidden="true">
          📘
        </span>
        <span>
          <strong>Guía rápida de mantenimiento</strong>
          <span className="guide__hint">
            Qué revisar y cada cuánto · {vehicleType === 'motorcycle' ? 'moto' : 'carro'}
          </span>
        </span>
      </summary>
      <div className="guide__grid">
        {tips.map(tip => (
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
        el vehículo en ciudad, con mucho tráfico, tierra o carga.
      </p>
    </details>
  )
}
