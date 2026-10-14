import React from 'react'
import { LegalLayout } from '../components/LegalLayout'
import type { LegalDocument } from '../components/LegalLayout'

const document: LegalDocument = {
  title: 'Privacy Policy',
  updated: '14 October 2026',
  intro:
    'This Privacy Policy explains what information Swim Sheet collects, why we collect it, and what choices you have. It applies to the Swim Sheet web app and progressive web app (the "App"). The App is developed and operated by an individual developer based in Israel, who acts as the data controller for information collected through the App. The source code is published at https://github.com/avieshel/swim-sheet.',
  sections: [
    {
      heading: '1. Information you give us',
      paragraphs: [
        'You choose what to enter into the App. This can include swimmer names, groups, notes, labels, practice session plans, lap times, stroke counts, distances, and coach or team names. If you create an account, we also receive your email address and a display name.',
        'Swimmer records frequently concern minors. You are responsible for entering only information you are authorised to process, and for obtaining any consent a parent or guardian must give in your jurisdiction. Swim Sheet does not knowingly collect personal information directly from children under 13; if you believe a child has provided us personal information, contact us and we will delete it.',
      ],
    },
    {
      heading: '2. How we store and use information',
      paragraphs: [
        'The App is offline-first. Roster, session, and timing data is written to your device in IndexedDB and stays there unless you sign in, which syncs it to our hosted database.',
        'We use your information to operate the App: to sync and back up your data across devices, to authenticate your account, to respond to support requests, and to detect and fix errors. We do not sell your information.',
      ],
    },
    {
      heading: '3. Service providers',
      paragraphs: [
        'We rely on third-party providers to run parts of the service. They process information only on our instructions and are bound by their own privacy terms.',
      ],
      bullets: [
        'Supabase — hosting, database, and authentication infrastructure.',
        'Cloudflare — content delivery, static hosting, and security.',
      ],
    },
    {
      heading: '4. Analytics',
      paragraphs: [
        'The App records usage events such as which screens you open and which features you use. **Events are recorded whether or not you are signed in.** When you are signed in, an event is linked to your user ID; when you are not, it is recorded with no user ID at all.',
        'To record an event we generate a device ID — a random identifier stored on your device, not derived from anything about you or your hardware. Alongside events we record app version, platform, time zone, device country, language, operating system, device type, screen size, and network type. This is not tied to a person and is not used to identify you.',
        'We use analytics to understand which features are used, to measure reliability, and to guide what we build next. Event payloads deliberately avoid swimmer names, notes, and lap times — they contain counts and aggregates instead. Because events fire before you sign in, they carry no coaching data.',
      ],
    },
    {
      heading: '5. Retention and deletion',
      paragraphs: [
        'Coaching data synced to our servers is retained until you delete it or close your account. You can delete individual swimmers, sessions, and runs from within the App, and closing an account removes the data linked to it.',
        'Analytics events are retained for up to 24 months and are then deleted. Aggregated, non-identifying statistics may be kept indefinitely.',
      ],
    },
    {
      heading: '6. Your rights',
      paragraphs: [
        'Depending on where you live, you may have the right to access, correct, export, or delete your personal information, to object to certain processing, or to withdraw consent. Where these rights apply, you can exercise most of them directly in the App.',
        'If you are in the EEA, UK, or Switzerland, you have the right to lodge a complaint with your local data protection authority.',
      ],
    },
    {
      heading: '7. Security',
      paragraphs: [
        'We use HTTPS in transit, row-level access controls in the database, and authentication on all synced routes. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.',
      ],
    },
    {
      heading: '8. Controller and international transfers',
      paragraphs: [
        'The controller for information collected through the App is an individual developer based in Israel. Because our hosting and authentication providers are established outside Israel, information you sync may be processed in other countries, including outside your own. Where required, we rely on standard contractual clauses or an equivalent safeguard for those transfers.',
      ],
    },
    {
      heading: '9. Children',
      paragraphs: [
        'The App is intended for use by swim coaches and clubs, not by children. Coaches may record information about swimmers who are minors, and are the controller of that information for the purposes of their own legal obligations.',
        '**Swim Sheet does not ask for a swimmer’s age or date of birth, and does not store either.** The only swimmer fields the App records are name, group, notes, and optional free-text labels. Because no date of birth is collected, the App cannot and does not determine a swimmer’s age.',
        'You are responsible for any consent a parent or guardian must give before you record information about a minor, and for meeting any obligations your club, governing body, or local law places on you. We do not verify ages or obtain parental consent on your behalf.',
        'Coaching data stays on your device unless you choose to sign in. Signing in is what sends swimmer records to our servers, so a signed-out user — and any coach who never signs in — has no coaching data on our side at all.',
      ],
    },
    {
      heading: '10. AI session drafting',
      paragraphs: [
        'Swim Sheet offers an optional "Create with AI" feature that turns a plain-language description of a training session into an editable session draft. This is the only feature that requires you to sign in; everything else in the app stays no-account and offline-first.',
        'Before anything is sent, the app redacts swimmer names, email addresses, and phone numbers that it can identify locally, and sends only the redacted description plus structural context: pool length, distance units, the equipment options you have enabled, and the distances, strokes, and repeat patterns of your two most recent sessions. It never sends swimmer records, roster counts, session or drill names and notes, or your drill library.',
        'The redacted text and structural context are sent to the third-party language model provider we have configured (see Service providers). Automatic redaction is best-effort and not guaranteed to catch every personal detail, especially unknown names, so do not enter swimmer-identifying or health information. The server checks the model\'s response against your local swimmer names and blocks the draft if a match is found; nothing is saved in that case.',
      ],
    },
    {
      heading: '11. Changes to this policy',
      paragraphs: [
        'We may update this policy as the App changes. The "Last updated" date above always reflects the current version, and we will post a notice in the App if we make a material change.',
      ],
    },
    {
      heading: '12. Contact',
      paragraphs: [
        'The developer of Swim Sheet is based in Israel. For privacy questions, to make a data request, or to report a data concern, open an issue at https://github.com/avieshel/swim-sheet/issues. Because the project is maintained by an individual, responses may take some time.',
      ],
    },
  ],
}

export const Privacy: React.FC = () => <LegalLayout document={document} />