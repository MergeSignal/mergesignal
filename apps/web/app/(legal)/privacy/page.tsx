import type { Metadata } from "next";
import Link from "next/link";

import docStyles from "../../components/shared/DocArticle/DocArticle.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy - MergeSignal",
  description:
    "How MergeSignal collects, uses, and protects data, including Customer Content restrictions.",
};

export default function PrivacyPage() {
  return (
    <article className={docStyles.article}>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Effective Date:</strong> March 16, 2026
      </p>

      <h2>1. Introduction</h2>
      <p>
        This Privacy Policy describes how MergeSignal (&quot;we&quot;,
        &quot;our&quot;, or &quot;the Service&quot;) collects, uses, stores, and
        protects information when you use the Service.
      </p>
      <p>
        By using MergeSignal, you consent to the data practices described in
        this policy.
      </p>

      <h2>2. Information We Collect</h2>

      <h3>2.1 Restrictions on use of Customer Content</h3>
      <p>
        <strong>&ldquo;Customer Content&rdquo;</strong> means data you (or an
        integration on your behalf) submit to operate the Service-for example
        dependency manifests, lockfiles, structured dependency graphs,
        repository identifiers, and analysis outputs-not your unrelated private
        business documents unless you choose to upload them.
      </p>
      <p>
        For the <strong>official hosted Service</strong> (and consistent with
        how self-hosted operators should treat their users&apos; data),
        MergeSignal <strong>does not</strong>:
      </p>
      <ul>
        <li>
          <strong>Sell</strong> Customer Content or scan inputs to data brokers
          or unrelated third parties;
        </li>
        <li>
          use Customer Content to{" "}
          <strong>
            train generalized machine-learning models for unrelated third
            parties
          </strong>{" "}
          (for example, selling embeddings or corpora derived from your
          repositories to model vendors); or
        </li>
        <li>
          use Customer Content for any purpose <strong>other than</strong>{" "}
          providing, securing, improving, and billing for the Service as
          described in this Policy and in the Terms of Service.
        </li>
      </ul>
      <p>
        <strong>Improvements to the Service</strong> may use{" "}
        <strong>aggregated, de-identified</strong> statistics (for example,
        overall scan volume or error rates), security and abuse signals, and
        product telemetry that does not reproduce your confidential inputs.
        Where optional features need richer feedback, we will describe that
        in-product or in this Policy.
      </p>
      <p>
        <strong>What we persist:</strong> The Service stores what is needed to
        run analyses and show history-typically repository identifiers,{" "}
        <strong>lockfile or manifest-derived inputs</strong> you supply (or that
        the GitHub App sends for changed paths), structured dependency
        summaries, <strong>analysis results</strong> (scores, signals,
        recommendations), quotas, and audit-relevant metadata. We do{" "}
        <strong>not</strong> operate the standard product as a bulk mirror of
        your <strong>private application source code tree</strong> (for example
        every <code>.ts</code> / <code>.go</code> file in the repo); if a
        feature ever ingests more than dependency-oriented inputs, that
        feature&apos;s documentation will say so explicitly.
      </p>

      <h3>2.2 Information You Provide</h3>
      <p>When using the Service, you may provide:</p>
      <ul>
        <li>
          <strong>Repository information</strong>: Repository names, owner
          identifiers, dependency graphs, and lockfile contents
        </li>
        <li>
          <strong>API credentials</strong>: API keys and authentication tokens
          (securely hashed and stored)
        </li>
        <li>
          <strong>GitHub data</strong>: If using the GitHub App integration, we
          receive repository metadata, pull request information, and webhook
          events
        </li>
        <li>
          <strong>Organization data</strong>: Organization identifiers and
          settings for multi-tenant usage
        </li>
      </ul>

      <h3>2.3 Automatically Collected Information</h3>
      <p>We automatically collect:</p>
      <ul>
        <li>
          <strong>Usage data</strong>: API requests, endpoint access patterns,
          scan frequency, and feature usage
        </li>
        <li>
          <strong>Technical data</strong>: IP addresses, request headers, user
          agents, and request identifiers
        </li>
        <li>
          <strong>Performance data</strong>: Response times, error rates, and
          system metrics
        </li>
        <li>
          <strong>Scan results</strong>: Risk scores, detected signals,
          vulnerability information, and analysis outputs
        </li>
      </ul>

      <h3>2.4 Third-Party Data</h3>
      <p>We may collect data from third-party sources to enrich analysis:</p>
      <ul>
        <li>
          <strong>npm registry</strong>: Package metadata, download statistics,
          and maintainer information
        </li>
        <li>
          <strong>OSV vulnerability database</strong>: CVE and advisory
          information for known vulnerabilities
        </li>
        <li>
          <strong>GitHub API</strong>: Repository health metrics, issue counts,
          and maintainer activity (if enabled)
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>
          <strong>Provide the Service</strong>: Analyze dependency upgrades,
          identify affected flows, and generate reviewer guidance
        </li>
        <li>
          <strong>
            Improve the Service (within the limits of Section 2.1)
          </strong>
          : Tune heuristics, fix bugs, and build <strong>aggregate</strong>{" "}
          product insights-without selling Customer Content or using it to train
          third-party foundation models as described above
        </li>
        <li>
          <strong>Maintain security</strong>: Monitor for abuse, prevent
          unauthorized access, and protect infrastructure
        </li>
        <li>
          <strong>Optimize performance</strong>: Identify bottlenecks, improve
          response times, and scale resources
        </li>
        <li>
          <strong>Communicate updates</strong>: Notify you of important changes,
          security issues, or service disruptions
        </li>
        <li>
          <strong>Enforce policies</strong>: Apply rate limits, quotas, and
          tier-based restrictions
        </li>
        <li>
          <strong>Generate analytics</strong>: Create aggregate, anonymized
          statistics about platform usage
        </li>
      </ul>

      <h2>4. Data Storage and Retention</h2>

      <h3>4.1 Where Data is Stored</h3>
      <p>Your data is stored in:</p>
      <ul>
        <li>
          <strong>PostgreSQL database</strong>: Scan status, scores,{" "}
          <strong>analysis results (JSON)</strong>, repository/org identifiers,
          policies, alerts, and related metadata-<strong>not</strong> a
          wholesale copy of your application source tree unless you have
          uploaded such content as part of a documented feature
        </li>
        <li>
          <strong>Redis cache</strong>: Temporary job queues, session data, and
          cached API responses (transient; see retention below)
        </li>
        <li>
          <strong>Application logs</strong>: Request logs, error logs, and audit
          trails
        </li>
      </ul>

      <h3>4.2 Data Retention</h3>
      <p>We retain data as follows:</p>
      <ul>
        <li>
          <strong>Scan results</strong>: Retained indefinitely unless explicitly
          deleted by the user
        </li>
        <li>
          <strong>API keys</strong>: Retained until revoked or the organization
          is deleted
        </li>
        <li>
          <strong>Request logs</strong>: Retained for 90 days for debugging and
          security monitoring
        </li>
        <li>
          <strong>Job queue data</strong>: Retained for 7 days after job
          completion
        </li>
        <li>
          <strong>Cached data</strong>: Retained according to TTL settings
          (typically 1-24 hours)
        </li>
      </ul>
      <p>
        You may request deletion of your data by contacting us (see Section 10).
      </p>

      <h2>5. Data Sharing and Disclosure</h2>

      <h3>5.1 We Do Not Sell Your Data</h3>
      <p>
        We do not sell, rent, or trade your personal information or scan data to
        third parties.
      </p>

      <h3>5.2 Third-Party Services</h3>
      <p>
        We may share limited data with third-party services necessary for
        operation:
      </p>
      <ul>
        <li>
          <strong>Cloud infrastructure providers</strong>: For hosting
          databases, APIs, and worker processes
        </li>
        <li>
          <strong>Monitoring services</strong>: For error tracking, performance
          monitoring, and uptime alerts
        </li>
        <li>
          <strong>External APIs</strong>: Package registries, vulnerability
          databases, and code hosting platforms (only data necessary for
          analysis)
        </li>
      </ul>
      <p>
        These third parties are bound by confidentiality obligations and may
        only use data to provide services to us.
      </p>

      <h3>5.3 Legal Requirements</h3>
      <p>We may disclose information if required to:</p>
      <ul>
        <li>Comply with applicable laws, regulations, or legal processes</li>
        <li>Respond to lawful requests from government authorities</li>
        <li>Enforce our Terms of Service or protect our rights</li>
        <li>Prevent fraud, abuse, or security threats</li>
        <li>Protect the safety and rights of users or the public</li>
      </ul>

      <h3>5.4 Business Transfers</h3>
      <p>
        In the event of a merger, acquisition, or sale of assets, your
        information may be transferred to the acquiring entity. We will notify
        you of any such change and provide options regarding your data.
      </p>

      <h2>6. Data Security</h2>
      <p>We implement reasonable security measures to protect your data:</p>
      <ul>
        <li>
          <strong>Encryption</strong>: Data in transit is encrypted using
          TLS/HTTPS; sensitive data at rest is encrypted
        </li>
        <li>
          <strong>Access controls</strong>: Role-based access, API key
          authentication, and principle of least privilege
        </li>
        <li>
          <strong>Secure storage</strong>: Hashed passwords/keys, secure
          database configurations, and isolated environments
        </li>
        <li>
          <strong>Monitoring</strong>: Continuous security monitoring, intrusion
          detection, and audit logging
        </li>
        <li>
          <strong>Regular updates</strong>: Timely security patches and
          dependency updates
        </li>
      </ul>
      <p>
        <strong>However</strong>, no method of transmission or storage is 100%
        secure. We cannot promise absolute security; we nonetheless implement
        the controls in this Policy in <strong>good faith</strong> and work to
        address identified issues promptly.
      </p>

      <h2>7. Your Rights and Choices</h2>
      <p>Depending on your jurisdiction, you may have the following rights:</p>

      <h3>7.1 Access and Portability</h3>
      <ul>
        <li>Request a copy of the data we hold about you</li>
        <li>
          Receive your data in a structured, machine-readable format (e.g., JSON
          export of scan results)
        </li>
      </ul>

      <h3>7.2 Correction and Deletion</h3>
      <ul>
        <li>Correct inaccurate or incomplete information</li>
        <li>
          Request deletion of your data (&quot;right to be forgotten&quot;)
        </li>
      </ul>

      <h3>7.3 Restriction and Objection</h3>
      <ul>
        <li>Restrict processing of your data for specific purposes</li>
        <li>Object to processing based on legitimate interests</li>
      </ul>

      <h3>7.4 Withdraw Consent</h3>
      <ul>
        <li>
          Withdraw consent for data processing at any time (may limit Service
          functionality)
        </li>
      </ul>

      <h3>7.5 API Key Management</h3>
      <ul>
        <li>Generate, revoke, or rotate API keys at any time</li>
        <li>View API key usage and access logs</li>
      </ul>
      <p>
        To exercise these rights, contact us using the information in Section
        10.
      </p>

      <h2>8. International Data Transfers</h2>
      <p>
        If you access the Service from outside the jurisdiction where our
        servers are located, your information may be transferred to and
        processed in other countries. We take steps to ensure adequate
        protection through:
      </p>
      <ul>
        <li>Standard contractual clauses (where applicable)</li>
        <li>Compliance with applicable data protection frameworks</li>
        <li>Security measures equivalent to those in your jurisdiction</li>
      </ul>

      <h2>9. GDPR Compliance (for EU/EEA Users)</h2>
      <p>
        If you are located in the European Union or European Economic Area, you
        have additional rights under the General Data Protection Regulation
        (GDPR):
      </p>

      <h3>9.1 Legal Basis for Processing</h3>
      <p>We process your data based on:</p>
      <ul>
        <li>
          <strong>Contractual necessity</strong>: To provide the Service as
          agreed in the <Link href="/terms">Terms of Service</Link>
        </li>
        <li>
          <strong>Legitimate interests</strong>: To improve the Service, prevent
          abuse, and ensure security
        </li>
        <li>
          <strong>Consent</strong>: Where you have explicitly provided consent
          (e.g., optional features)
        </li>
        <li>
          <strong>Legal obligations</strong>: To comply with applicable laws
        </li>
      </ul>

      <h3>9.2 Data Protection Officer</h3>
      <p>
        For GDPR-related inquiries, contact our Data Protection Officer (see
        Section 10).
      </p>

      <h3>9.3 Supervisory Authority</h3>
      <p>
        You have the right to lodge a complaint with your local data protection
        supervisory authority if you believe your data has been mishandled.
      </p>

      <h2>10. Contact and Data Requests</h2>
      <p>
        For privacy-related inquiries, data access requests, or to exercise your
        rights, contact us at:
      </p>
      <ul>
        <li>
          <strong>Email</strong>: See <Link href="/contact">Contact</Link> for
          contact information
        </li>
        <li>
          <strong>GitHub</strong>: Open a confidential issue in the repository
          (for non-sensitive inquiries)
        </li>
      </ul>
      <p>
        We will respond to requests within 30 days (or as required by applicable
        law).
      </p>

      <h2>11. Children&apos;s Privacy</h2>
      <p>
        The Service is not intended for users under the age of 16 (or the age of
        digital consent in your jurisdiction). We do not knowingly collect
        information from children. If you believe we have collected data from a
        child, contact us immediately, and we will delete it.
      </p>

      <h2>12. Cookies and Tracking</h2>
      <p>The Service uses minimal tracking technologies:</p>
      <ul>
        <li>
          <strong>Session cookies</strong>: For authentication and maintaining
          user sessions
        </li>
        <li>
          <strong>Local storage</strong>: For storing UI preferences and API
          keys (client-side only)
        </li>
        <li>
          <strong>Logs</strong>: IP addresses and request headers for security
          and debugging
        </li>
      </ul>
      <p>
        We do <strong>not</strong> use:
      </p>
      <ul>
        <li>Third-party advertising or analytics cookies</li>
        <li>Cross-site tracking or behavioral profiling</li>
        <li>
          Persistent identifiers beyond what is necessary for Service operation
        </li>
      </ul>

      <h2>13. Open Source Considerations</h2>
      <p>
        MergeSignal includes open-source components under the{" "}
        <strong>Apache License, Version 2.0</strong> (see the{" "}
        <code>LICENSE</code> and <code>NOTICE</code> files). When using the
        open-source components:
      </p>
      <ul>
        <li>You are responsible for data handling in your own deployment</li>
        <li>Self-hosted instances are not covered by this Privacy Policy</li>
        <li>
          You must create your own privacy policy if offering the Service to
          others
        </li>
      </ul>
      <p>
        This Privacy Policy applies to the official hosted instance of
        MergeSignal.
      </p>

      <h2>14. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy periodically. Changes will be notified
        through:
      </p>
      <ul>
        <li>Updates published on the MergeSignal website</li>
        <li>Notices in the application interface</li>
        <li>Email notifications (if contact information is available)</li>
      </ul>
      <p>
        Continued use of the Service after changes constitutes acceptance of the
        updated policy. Material changes will include a revised &quot;Effective
        Date&quot; at the top of this document.
      </p>

      <h2>15. California Privacy Rights (CCPA)</h2>
      <p>
        If you are a California resident, you have additional rights under the
        California Consumer Privacy Act (CCPA):
      </p>
      <ul>
        <li>
          <strong>Right to know</strong>: What personal information is collected
          and how it is used
        </li>
        <li>
          <strong>Right to delete</strong>: Request deletion of your personal
          information
        </li>
        <li>
          <strong>Right to opt-out</strong>: Opt-out of the &quot;sale&quot; of
          personal information (note: we do not sell data)
        </li>
        <li>
          <strong>Right to non-discrimination</strong>: Equal service regardless
          of privacy choices
        </li>
      </ul>
      <p>
        To exercise these rights, contact us using the information in Section
        10.
      </p>

      <h2>16. Data Breach Notification</h2>
      <p>
        In the event of a data breach that may affect your information, we will:
      </p>
      <ul>
        <li>Notify affected users within 72 hours (or as required by law)</li>
        <li>Describe the nature of the breach and affected data</li>
        <li>Provide recommendations for protective measures</li>
        <li>Notify relevant supervisory authorities as required</li>
      </ul>

      <hr />

      <p>
        <strong>Last Updated:</strong> March 16, 2026
      </p>
      <p>
        <strong>
          For questions about this Privacy Policy, please see{" "}
          <Link href="/contact">Contact</Link>.
        </strong>
      </p>
    </article>
  );
}
