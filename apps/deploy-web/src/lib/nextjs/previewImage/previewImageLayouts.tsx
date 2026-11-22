import type { CSSProperties, FC, ReactNode } from "react";

import type { PreviewImageContent, PublisherPreviewContent, TemplatePreviewContent } from "@src/services/marketplace-preview-image/preview-image-content";

export const PREVIEW_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const PREVIEW_IMAGE_FONT_FAMILY = "Geist";

const COLORS = {
  background: "#0a0a0b",
  surface: "#18181b",
  border: "#27272a",
  text: "#fafafa",
  mutedText: "#a1a1aa",
  brand: "#ff414c",
  verified: "#3b82f6"
} as const;

const STYLES = {
  canvas: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    width: PREVIEW_IMAGE_SIZE.width,
    height: PREVIEW_IMAGE_SIZE.height,
    padding: 64,
    backgroundColor: COLORS.background,
    backgroundImage: `radial-gradient(circle at 100% 0%, rgba(255, 65, 76, 0.22), rgba(10, 10, 11, 0) 55%)`,
    color: COLORS.text,
    fontFamily: PREVIEW_IMAGE_FONT_FAMILY
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand: { display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 600 },
  section: { color: COLORS.mutedText, fontWeight: 400 },
  label: {
    display: "flex",
    padding: "10px 20px",
    border: `2px solid ${COLORS.border}`,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    color: COLORS.mutedText,
    fontSize: 24
  },
  body: { display: "flex", flexDirection: "column", gap: 20 },
  title: { display: "block", lineClamp: 2, fontSize: 68, fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.5, wordBreak: "break-word" },
  publisherName: {
    display: "block",
    lineClamp: 2,
    maxWidth: 840,
    fontSize: 60,
    fontWeight: 600,
    lineHeight: 1.1,
    letterSpacing: -1.5,
    wordBreak: "break-word"
  },
  description: { display: "block", lineClamp: 2, color: COLORS.mutedText, fontSize: 30, lineHeight: 1.35, wordBreak: "break-word" },
  footer: { display: "flex", flexDirection: "column", gap: 24 },
  publisher: { display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 600 },
  initials: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    height: 64,
    border: `2px solid ${COLORS.border}`,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    fontSize: 26
  },
  largeInitials: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 112,
    height: 112,
    border: `2px solid ${COLORS.border}`,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    fontSize: 46,
    fontWeight: 600
  },
  publisherHeading: { display: "flex", alignItems: "center", gap: 28 },
  nameRow: { display: "flex", alignItems: "center", gap: 18 },
  facts: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, color: COLORS.mutedText, fontSize: 26 },
  fact: { display: "flex", alignItems: "center", gap: 14 },
  factSeparator: { display: "flex", width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border }
} satisfies Record<string, CSSProperties>;

const TEMPLATES_LABEL = "Templates";
const PUBLISHER_LABEL = "Community publisher";

export const PreviewImageLayout: FC<{ content: PreviewImageContent }> = ({ content }) =>
  content.kind === "template" ? <TemplatePreviewLayout content={content} /> : <PublisherPreviewLayout content={content} />;

const TemplatePreviewLayout: FC<{ content: TemplatePreviewContent }> = ({ content }) => (
  <Canvas label={content.trustLabel}>
    <div style={STYLES.body}>
      <div style={STYLES.title}>{content.title}</div>
      {content.summary && <div style={STYLES.description}>{content.summary}</div>}
    </div>
    <div style={STYLES.footer}>
      <Facts facts={content.hardware} />
      {content.publisher && (
        <div style={STYLES.publisher}>
          {content.publisher.initials && <div style={STYLES.initials}>{content.publisher.initials}</div>}
          <span>{content.publisher.name}</span>
          {content.publisher.isVerified && <VerifiedMark size={34} />}
        </div>
      )}
    </div>
  </Canvas>
);

const PublisherPreviewLayout: FC<{ content: PublisherPreviewContent }> = ({ content }) => (
  <Canvas label={PUBLISHER_LABEL}>
    <div style={STYLES.body}>
      <div style={STYLES.publisherHeading}>
        {content.initials && <div style={STYLES.largeInitials}>{content.initials}</div>}
        <div style={STYLES.nameRow}>
          <div style={STYLES.publisherName}>{content.name}</div>
          {content.isVerified && <VerifiedMark size={52} />}
        </div>
      </div>
      {content.bio && <div style={STYLES.description}>{content.bio}</div>}
    </div>
    <div style={STYLES.footer}>
      <Facts facts={content.counts} />
    </div>
  </Canvas>
);

const Canvas: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div style={STYLES.canvas}>
    <div style={STYLES.header}>
      <div style={STYLES.brand}>
        <AkashMark />
        <span>Akash Console</span>
        <span style={STYLES.section}>{TEMPLATES_LABEL}</span>
      </div>
      <div style={STYLES.label}>{label}</div>
    </div>
    {children}
  </div>
);

const Facts: FC<{ facts: string[] }> = ({ facts }) => (
  <div style={STYLES.facts}>
    {facts.map((fact, index) => (
      <div key={fact} style={STYLES.fact}>
        {index > 0 && <div style={STYLES.factSeparator} />}
        <span>{fact}</span>
      </div>
    ))}
  </div>
);

const AkashMark: FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="46" height="41" viewBox="0 0 185 164" fill="none">
    <path d="M115.175 107.912L139.598 136.586L153.656 161.428H92.1936L61.4452 107.912H115.175Z" fill={COLORS.brand} />
    <path d="M153.64 161.437L184.338 107.921L122.892 0.861938H61.4452L153.64 161.437Z" fill={COLORS.brand} />
    <path d="M30.7229 54.3643H92.1692L30.7485 161.423L0 107.907L30.7229 54.3643Z" fill={COLORS.brand} />
  </svg>
);

const VerifiedMark: FC<{ size: number }> = ({ size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill={COLORS.verified} />
    <path d="M7 12.5L10.5 16L17 9" stroke={COLORS.text} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
