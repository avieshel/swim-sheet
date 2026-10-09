import React from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'

const features = [
  {
    icon: 'timer',
    title: 'Live timing deck',
    body: 'Time every lane on deck with tap-per-lap controls, stroke counts, and a running clock built for poolside use.',
  },
  {
    icon: 'event_note',
    title: 'Session builder',
    body: 'Compose practice plans from warm-up to cool-down, then promote a template into a live session with one tap.',
  },
  {
    icon: 'library_books',
    title: 'Drill bank',
    body: 'Organize drills by stroke, focus, phase, and equipment so your whole library is ready before you hit the water.',
  },
  {
    icon: 'groups',
    title: 'Swimmer roster',
    body: 'Keep your swimmers, groups, and notes in one place and attach them to any run as you coach.',
  },
  {
    icon: 'cloud_off',
    title: 'Works offline',
    body: 'A progressive web app that runs on any device and keeps working when the pool deck Wi-Fi does not.',
  },
  {
    icon: 'history',
    title: 'Run history',
    body: 'Every completed practice is saved with lap times and distances so you can review progress over the season.',
  },
]

const steps = [
  {
    icon: 'edit_note',
    title: 'Build your practice',
    body: 'Pick or create a session template, add drills, sets, and distances.',
  },
  {
    icon: 'play_circle',
    title: 'Run it live on deck',
    body: 'Open the live deck and time each swimmer lap by lap as they swim.',
  },
  {
    icon: 'insights',
    title: 'Review the results',
    body: 'Save the run and look back at times, stroke counts, and totals afterwards.',
  },
]

const faqs = [
  {
    q: 'What is Swim Sheet?',
    a: 'Swim Sheet is a swim coaching app for building practice plans, timing swimmers live on deck, and reviewing results. It combines a session builder, drill bank, swimmer roster, and a lap-by-lap live timing deck in one tool.',
  },
  {
    q: 'Does Swim Sheet work offline?',
    a: 'Yes. Swim Sheet is an offline-first progressive web app. Your sessions, swimmers, and timing data are stored on your device, so you can run a practice even without a pool-side internet connection.',
  },
  {
    q: 'Where is my coaching data stored?',
    a: 'On your device, unless you choose to sign in. Without an account nothing is synced — a coach who never signs in has no roster or session data on our servers. Signing in is what enables cross-device sync and backup.',
  },
  {
    q: 'What devices does Swim Sheet support?',
    a: 'Swim Sheet runs in any modern browser on phones, tablets, and laptops, and can be installed as a progressive web app on Android and iOS. It is designed portrait-first for use on the pool deck.',
  },
  {
    q: 'Can I time several swimmers at once?',
    a: 'Yes. The live deck shows an active lane per swimmer, so you can tap each swimmer as they finish a lap while the clock keeps running for everyone.',
  },
  {
    q: 'Does Swim Sheet ask for swimmer ages or dates of birth?',
    a: 'No. Swim Sheet never asks for a swimmer’s age or date of birth, and does not store either — the only swimmer fields it records are name, group, notes, and optional labels. Your roster stays on your device unless you sign in, and signing in is what sends your coaching data to our servers. Because we hold no dates of birth, we never determine a swimmer’s age.',
  },
  {
    q: 'Does Swim Sheet replace my own coaching judgement?',
    a: 'No. Swim Sheet is an optional record-keeping and timing tool. Every session, drill, and distance you enter or follow is your own decision, and you stay fully responsible for the safety and welfare of the swimmers you coach. Swim Sheet provides no coaching, training, or medical advice and takes no responsibility for the training actually conducted or for any injury arising from it.',
  },
  {
    q: 'How much does Swim Sheet cost?',
    a: 'Swim Sheet is free to use today. Some parts of the App may later move behind a paid plan — if that happens you will be told what is charged and what it covers before anything is billed, and anything you already use for free will not be charged retroactively. See the Terms of Service for details.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export const Landing: React.FC = () => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <header className="border-b border-outline-variant sticky top-0 z-40 bg-surface/95 backdrop-blur-md">
        <div className="r-container flex items-center justify-between py-3 md:py-4">
          <Link to="/" className="flex items-center gap-2 md:gap-3 no-underline text-on-surface">
            <Icon name="pool" size="xl" color="primary" />
            <span className="font-headline-md font-bold text-primary">Swim Sheet</span>
          </Link>
          <Link
            to="/"
            className="bg-primary text-on-primary font-bold h-10 px-5 rounded-full flex items-center gap-2 hover:shadow-lg active:scale-95 transition-all no-underline"
          >
            Open app
            <Icon name="arrow_forward" size="sm" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="r-container pt-14 md:pt-24 pb-12 md:pb-20 text-center">
          <span className="font-label-caps bg-primary-container/10 text-primary px-4 py-1.5 rounded-full inline-block mb-6">
            Swim coaching, organized
          </span>
          <h1 className="font-headline-lg text-headline-lg max-w-3xl mx-auto mb-6">
            Plan practices and time your swimmers from one app
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-8">
            Swim Sheet helps swim coaches build session templates, run a lap-by-lap live timing deck on
            deck, and keep a full roster and drill bank — offline-first, on any device.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <Link
              to="/"
              className="bg-primary text-on-primary font-bold h-12 px-8 rounded-full flex items-center justify-center gap-2 hover:shadow-xl active:scale-95 transition-all no-underline"
            >
              <Icon name="bolt" fill />
              Start timing
            </Link>
            <a
              href="#how-it-works"
              className="bg-surface-container-high text-on-surface font-bold h-12 px-8 rounded-full flex items-center justify-center gap-2 hover:shadow-lg active:scale-95 transition-all no-underline"
            >
              How it works
            </a>
          </div>
        </section>

        <section className="r-container pb-12 md:pb-20" aria-labelledby="features-heading">
          <h2 id="features-heading" className="font-headline-md text-headline-md text-center mb-8 md:mb-12">
            Everything a practice needs
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/50"
              >
                <span className="bg-primary-container/20 text-primary w-11 h-11 rounded-2xl flex items-center justify-center mb-4">
                  <Icon name={f.icon} size="lg" fill />
                </span>
                <h3 className="font-headline-md text-headline-md mb-2">{f.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="r-container pb-12 md:pb-20" aria-labelledby="how-heading">
          <h2 id="how-heading" className="font-headline-md text-headline-md text-center mb-8 md:mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/50">
                <span className="font-label-caps text-primary mb-4 inline-block">Step {i + 1}</span>
                <span className="block text-primary mb-3">
                  <Icon name={s.icon} size="2xl" />
                </span>
                <h3 className="font-headline-md text-headline-md mb-2">{s.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="r-container pb-12 md:pb-20" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-headline-md text-headline-md text-center mb-8 md:mb-12">
            Frequently asked questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/50">
                <h3 className="font-headline-md text-headline-md mb-2">{q}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="r-container pb-16 md:pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00677f] to-[#00d1ff] p-8 md:p-12 text-on-primary text-center">
            <h2 className="font-headline-md text-headline-md mb-3">Ready for your next practice?</h2>
            <p className="font-body-lg text-body-lg opacity-90 max-w-xl mx-auto mb-6">
              Open the live deck and start timing — no account required.
            </p>
            <Link
              to="/"
              className="bg-surface-container-lowest text-primary font-bold h-12 px-8 rounded-full inline-flex items-center gap-2 hover:shadow-xl active:scale-95 transition-all no-underline"
            >
              <Icon name="bolt" fill />
              Open the live deck
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant py-6">
        <div className="r-container flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md">
            <Icon name="pool" size="sm" color="primary" />
            Swim Sheet
          </span>
          <span className="text-on-surface-variant font-body-md text-body-md">
            Swim coaching session management &amp; timing
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-on-surface-variant font-body-md text-body-md">
            <Link to="/terms" className="no-underline hover:underline">
              Terms of Service
            </Link>
            <Link to="/privacy" className="no-underline hover:underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
