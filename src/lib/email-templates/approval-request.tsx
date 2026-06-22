import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  requesterName?: string
  kind?: string
  summary?: string
  confirmUrl?: string
}

const KIND_LABEL: Record<string, string> = {
  perform_cycle_publish: 'Publish performance review cycle',
  pulse_launch: 'Launch engagement survey',
  goal_program_publish: 'Publish goal program',
}

const ApprovalEmail = ({
  requesterName = 'Admin',
  kind = 'go-live',
  summary = 'A change is ready for your approval.',
  confirmUrl = 'https://boostmyworkforce.com',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm to publish: {KIND_LABEL[kind] ?? kind}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm before going live</Heading>
        <Text style={para}>Hi {requesterName},</Text>
        <Text style={para}>
          You requested to <strong>{KIND_LABEL[kind] ?? kind}</strong> on BoostMyWorkforce.
          Please review the summary below and click the button to finalize.
        </Text>
        <Section style={summaryBox}>
          <Text style={summaryText}>{summary}</Text>
        </Section>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={confirmUrl} style={btn}>Confirm and publish</Button>
        </Section>
        <Text style={small}>
          If you did not request this, you can safely ignore this email — nothing will be published.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ApprovalEmail,
  subject: (d: Record<string, any>) =>
    `Confirm: ${KIND_LABEL[d?.kind ?? ''] ?? 'BoostMyWorkforce approval'}`,
  displayName: 'Approval confirmation',
  previewData: {
    requesterName: 'Jackie',
    kind: 'pulse_launch',
    summary: 'Launch a monthly Pulse survey to 42 employees starting next Monday.',
    confirmUrl: 'https://example.com/approvals/abc',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 600, margin: '0 0 16px' }
const para = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 12px' }
const summaryBox = { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px 16px', margin: '16px 0' }
const summaryText = { fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#334155' }
const btn = { background: '#0EA5E9', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }
const small = { fontSize: '12px', color: '#64748B', marginTop: '20px' }
