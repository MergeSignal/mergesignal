import type { Metadata } from "next";

import { productMessaging } from "@mergesignal/shared";

import docStyles from "../../components/shared/DocArticle/DocArticle.module.css";

export const metadata: Metadata = {
  title: "Contact - MergeSignal",
  description:
    "Contact MergeSignal for legal, security, support, and business inquiries.",
};

export default function ContactPage() {
  return (
    <article className={docStyles.article}>
      <h1>Contact Information</h1>
      <p>{productMessaging.formalDefinition}</p>

      <h2>Legal Inquiries</h2>
      <p>For legal matters, including:</p>
      <ul>
        <li>Terms of Service questions</li>
        <li>Privacy Policy inquiries</li>
        <li>API Terms clarifications</li>
        <li>GDPR/CCPA data requests</li>
        <li>Copyright or trademark concerns</li>
        <li>Licensing questions</li>
      </ul>
      <p>Please contact:</p>
      <p>
        <strong>Email:</strong> legal@mergesignal.com
      </p>

      <h2>Data Protection Officer (GDPR)</h2>
      <p>For GDPR-related inquiries and data subject requests:</p>
      <p>
        <strong>Email:</strong> dpo@mergesignal.com
      </p>

      <h2>General Support</h2>
      <p>For technical support, bug reports, and feature requests:</p>
      <ul>
        <li>
          <strong>GitHub Issues</strong>:{" "}
          <a
            href="https://github.com/MergeSignal/mergesignal/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://github.com/MergeSignal/mergesignal/issues
          </a>
        </li>
        <li>
          <strong>Discussions</strong>:{" "}
          <a
            href="https://github.com/MergeSignal/mergesignal/discussions"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://github.com/MergeSignal/mergesignal/discussions
          </a>
        </li>
      </ul>

      <h2>Security Issues</h2>
      <p>For security vulnerabilities or confidential security matters:</p>
      <p>
        <strong>Email:</strong> security@mergesignal.com
      </p>
      <p>
        Please use responsible disclosure practices. Do not publicly disclose
        security issues until we have had an opportunity to address them.
      </p>
      <p>
        Alternatively, use{" "}
        <a
          href="https://github.com/MergeSignal/mergesignal/security/advisories"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Security Advisories
        </a>{" "}
        for private vulnerability reporting.
      </p>

      <h2>Business Inquiries</h2>
      <p>For partnerships, licensing, or commercial inquiries:</p>
      <p>
        <strong>Email:</strong> hello@mergesignal.com
      </p>

      <h2>Response Time</h2>
      <ul>
        <li>
          <strong>Legal inquiries</strong>: We aim to respond within 30 days (or
          as required by applicable law)
        </li>
        <li>
          <strong>Security issues</strong>: Acknowledged within 72 hours;
          patches prioritized based on severity
        </li>
        <li>
          <strong>General support</strong>: Best-effort basis; no guaranteed
          response time
        </li>
      </ul>

      <h2>Privacy and Confidentiality</h2>
      <p>When contacting us:</p>
      <ul>
        <li>
          Do not include sensitive data (passwords, API keys, PII) in emails or
          public issues
        </li>
        <li>Use encrypted communication for confidential matters</li>
        <li>Mark emails as &quot;Confidential&quot; if applicable</li>
      </ul>

      <h2>Updates</h2>
      <p>
        This contact information is current as of{" "}
        <strong>March 16, 2026</strong>. Check this file periodically for
        updates.
      </p>
    </article>
  );
}
