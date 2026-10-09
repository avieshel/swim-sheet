import React from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

interface LegalSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

/** `**text**` in a paragraph or bullet renders as bold. */
export interface LegalDocument {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

interface LegalLayoutProps {
  document: LegalDocument
}

const INLINE_STRONG = /\*\*(.+?)\*\*/g

const renderInline = (text: string): React.ReactNode[] =>
  text.split(INLINE_STRONG).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="text-on-surface font-semibold">{part}</strong> : part
  )

export const LegalLayout: React.FC<LegalLayoutProps> = ({ document }) => {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <header className="border-b border-outline-variant sticky top-0 z-40 bg-surface/95 backdrop-blur-md">
        <div className="r-container flex items-center justify-between py-3 md:py-4">
          <Link to="/about" className="flex items-center gap-2 md:gap-3 no-underline text-on-surface">
            <Icon name="arrow_back" size="sm" color="primary" />
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

      <main className="flex-1 r-container py-12 md:py-20">
        <article className="max-w-3xl mx-auto">
          <h1 className="font-headline-lg text-headline-lg mb-3">{document.title}</h1>
          <p className="font-body-md text-on-surface-variant mb-10">Last updated: {document.updated}</p>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-12">{document.intro}</p>

          {document.sections.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2 className="font-headline-md text-headline-md mb-3">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="font-body-md text-body-md text-on-surface-variant mb-4">
                  {renderInline(paragraph)}
                </p>
              ))}
              {section.bullets && (
                <ul className="font-body-md text-body-md text-on-surface-variant mb-4 space-y-2 pl-5 list-disc">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{renderInline(bullet)}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </main>

      <footer className="border-t border-outline-variant py-6">
        <div className="r-container flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link to="/about" className="no-underline">
            <span className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md">
              <Icon name="pool" size="sm" color="primary" />
              Swim Sheet
            </span>
          </Link>
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