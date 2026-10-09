import React from 'react'
import { LegalLayout } from '../components/LegalLayout'
import type { LegalDocument } from '../components/LegalLayout'

const document: LegalDocument = {
  title: 'Terms of Service',
  updated: '9 October 2026',
  intro:
    'These Terms of Service ("Terms") govern your use of the Swim Sheet web app and progressive web app (the "App"). The App is developed and operated by an individual developer based in Israel ("the developer", "we", "us", "our"). The source code for the App is published at https://github.com/avieshel/swim-sheet. By using the App you agree to these Terms. If you do not agree, please do not use the App.',
  sections: [
    {
      heading: '1. The service',
      paragraphs: [
        'Swim Sheet is a tool for swim coaches to build practice plans, run a live timing deck on poolside, and review results. It is provided online; we may add, change, or remove features at any time.',
      ],
    },
    {
      heading: '2. Accounts',
      paragraphs: [
        'Some features require an account. You are responsible for keeping your credentials secure and for activity that happens under your account. You must be old enough to enter a contract where you live; if you are under 18, a parent or guardian must agree to these Terms on your behalf.',
        'You may close your account at any time. We may suspend or close an account that violates these Terms, and we may limit or suspend access to protect the service or its users.',
      ],
    },
    {
      heading: '3. Your content',
      paragraphs: [
        'You keep ownership of the swimmer rosters, session plans, and timing data you enter ("Your Content"). You grant us only the narrow licence needed to host, store, back up, sync, and display that content so the App can work for you — for example, syncing Your Content to our servers when you sign in.',
        'You are responsible for having the right to enter Your Content, and for any permissions or consent it requires. Do not upload content you do not have the right to use.',
      ],
    },
    {
      heading: '4. Acceptable use',
      paragraphs: ['You agree not to use the App to:'],
      bullets: [
        'Break any law or infringe anyone’s rights.',
        'Upload malware, or interfere with, disrupt, or attempt to gain unauthorised access to the App or its infrastructure.',
        'Share, resell, or provide access to your account to anyone else.',
        'Scrape, reverse engineer, or extract the App’s source code except where that restriction is prohibited by law.',
        'Misuse the App in a way that harms you, other swimmers, coaches, or us.',
      ],
    },
    {
      heading: '5. Fees and payment',
      paragraphs: [
        'Swim Sheet is currently free to use, with no paid tiers and no in-app purchases. We may introduce paid plans, subscriptions, or paid features in the future. If we do, we will tell you what is charged and what it covers before anything is billed, and continued use after a change means you accept the new arrangement. We do not charge retroactively for features you used for free, and you can cancel at any time.',
      ],
    },
    {
      heading: '6. Third-party services',
      paragraphs: [
        'The App links to or relies on third-party services, including hosting and authentication providers. Their services are governed by their own terms, and we are not responsible for them.',
      ],
    },
    {
      heading: '7. Disclaimer',
      paragraphs: [
        'The App is provided "as is" and "as available", without warranties of any kind, whether express or implied, including fitness for a particular purpose, merchantability, non-infringement, accuracy, or uninterrupted availability. We do not warrant that the App will be error-free, that any result it produces is correct, or that your data will never be lost.',
      ],
    },
    {
      heading: '8. No responsibility for coaching, training, or safety',
      paragraphs: [
        'Swim Sheet is an optional record-keeping and time-keeping tool. It is not a coach, a training programme, or a source of coaching, fitness, medical, or safety advice, and it is not a substitute for your own professional judgement or for the judgement of a qualified coach, physiotherapist, doctor, or other professional.',
        '**We take no responsibility for the training that is actually conducted.** Every session, drill, set, distance, stroke, interval, and load decision you enter or follow is your own decision. We do not prescribe, validate, review, endorse, or recommend any training, and we have no control over whether a session is performed, how it is performed, or how any swimmer responds to it.',
        'You remain solely responsible for the safety and welfare of every swimmer you coach and for every instruction you give. We are not liable for any injury, illness, or harm of any kind, whether physical, psychological, or otherwise, suffered by you, your swimmers, your staff, or any third party, to the extent it arises from or relates to your use of the App or the training conducted with its assistance. This includes injury caused by overtraining, undertraining, a mis-timed or mis-recorded lap, a mis-entered distance or stroke count, or reliance on any figure the App displays.',
        'Always follow your pool’s supervision and safety rules, your governing body’s requirements, and any medical restrictions that apply to your swimmers. Where a swimmer has a medical condition, injury, or limitation, it is your responsibility to obtain appropriate professional advice and to act on it.',
        'You accept the App on the basis that it is a convenience tool for coaches who have chosen to use it and who retain full professional responsibility for everything they do with it.',
      ],
    },
    {
      heading: '9. Limitation of liability',
      paragraphs: [
        'To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost data, or lost practice results, arising from your use of the App.',
        'Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for death or personal injury caused by our negligence, or for fraud or fraudulent misrepresentation. Subject to that, our total aggregate liability to you for any claim is limited to the greater of the amount you paid us in the twelve months before the claim or USD 50.',
        'You agree to indemnify and hold us harmless from any claim, demand, loss, or expense (including reasonable legal fees) arising out of your use of the App, your coaching or training decisions, or your breach of these Terms.',
      ],
    },
    {
      heading: '10. Your backups',
      paragraphs: [
        'The App stores data on your device and, if you sign in, on our servers. You can export a copy of your data from the App’s settings at any time. We recommend exporting regularly — we are not obliged to keep Your Content available for any particular period.',
      ],
    },
    {
      heading: '11. Changes and termination',
      paragraphs: [
        'We may update these Terms. If a change is material, we will post a notice in the App or on the project repository. Continuing to use the App after that means you accept the updated Terms. You may stop using the App at any time; we may suspend or terminate access for breach of these Terms.',
      ],
    },
    {
      heading: '12. Governing law',
      paragraphs: [
        'These Terms are governed by the laws of the State of Israel, without regard to its conflict of laws rules. The courts of Israel have exclusive jurisdiction over any dispute arising out of or relating to these Terms or your use of the App, and you consent to that jurisdiction.',
        'If you are a consumer resident in the European Union or the United Kingdom, you retain any right to bring proceedings in your country of residence under the laws of that country. Nothing in this section removes or limits rights you have under mandatory consumer protection law that cannot be waived by agreement.',
        'If any part of these Terms is unenforceable, the rest stays in force. A failure to enforce a provision is not a waiver of it.',
      ],
    },
    {
      heading: '13. Contact',
      paragraphs: [
        'The developer of Swim Sheet is based in Israel. The source code and issue tracker for the project are hosted at https://github.com/avieshel/swim-sheet — please raise any question about these Terms there. Because the project is maintained by an individual, responses may take some time.',
      ],
    },
  ],
}

export const Terms: React.FC = () => <LegalLayout document={document} />