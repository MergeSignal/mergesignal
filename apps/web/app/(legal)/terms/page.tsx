import type { Metadata } from "next";
import Link from "next/link";

import docStyles from "../../components/shared/DocArticle/DocArticle.module.css";

export const metadata: Metadata = {
  title: "Terms of Service - MergeSignal",
  description:
    "MergeSignal Terms of Service: acceptable use, API rules, limitations, and liability.",
};

export default function TermsPage() {
  return (
    <article className={docStyles.article}>
      <h1>Terms of Service</h1>
      <p>
        <strong>Effective Date:</strong> March 16, 2026
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using MergeSignal (the &quot;Service&quot;), you agree
        to be bound by these Terms of Service (&quot;Terms&quot;). If you do not
        agree to these Terms, do not use the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>The Service includes:</p>
      <ul>
        <li>Web-based user interface</li>
        <li>RESTful API</li>
        <li>Command-line interface (CLI)</li>
        <li>GitHub App integration (optional)</li>
      </ul>

      <h2>
        3. Our commitments; nature of the Service; warranties and limitations
      </h2>

      <h3>3.1 How we treat Customer Content</h3>
      <p>
        We handle <strong>Customer Content</strong> (as defined in the Privacy
        Policy) <strong>only</strong> to provide, secure, bill for, and improve
        the Service within the limits stated there. In particular, for the
        official hosted Service, we <strong>do not</strong> sell Customer
        Content to data brokers, and we <strong>do not</strong> use Customer
        Content to train generalized machine-learning models for unrelated third
        parties, as further described in the Privacy Policy.
      </p>

      <h3>3.2 Informational analyses (not professional advice)</h3>
      <p>
        MergeSignal produces <strong>automated upgrade impact findings</strong>.
        That output is <strong>informational and decision-support only</strong>.
        It is <strong>not</strong> legal advice, not a professional penetration
        test or audit, and not a certification that a system is free of
        vulnerabilities or fit for any regulated purpose. You remain responsible
        for how you use outputs, for compliance with your own policies and laws,
        and for validating material decisions (for example, production releases
        or incident response).
      </p>

      <h3>3.3 No guarantee of specific results</h3>
      <p>
        To the <strong>maximum extent permitted by applicable law</strong>,
        MergeSignal <strong>does not warrant</strong> that the Service will be
        uninterrupted, error-free, or free of harmful components; that it will
        detect every vulnerability or misconfiguration; or that scores or
        recommendations will meet any particular business outcome or compliance
        standard. Third-party data sources (registries, advisories, hosting
        platforms) may be incomplete, delayed, or incorrect.
      </p>

      <h3>3.4 Open-source components</h3>
      <p>
        Portions of the software may be distributed under the{" "}
        <strong>Apache License, Version 2.0</strong>. The warranty disclaimer
        and limitation of liability in that license apply{" "}
        <strong>
          to those components in the form licensed under Apache 2.0
        </strong>
        . For <strong>hosted</strong> Service use, these Terms and the Privacy
        Policy also apply. If you self-host open-source components, you are
        responsible for your deployment and for providing appropriate notices to
        your own users.
      </p>

      <h3>3.5 Not legal advice</h3>
      <p>
        These Terms and our other policies are not a substitute for advice from{" "}
        <strong>qualified legal counsel</strong> about your specific
        obligations, industry, or jurisdiction.
      </p>

      <h2>4. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
        MERGESIGNAL, ITS OPERATORS, CONTRIBUTORS, OR LICENSORS BE LIABLE FOR
        ANY:
      </p>
      <ul>
        <li>
          Direct, indirect, incidental, special, consequential, or punitive
          damages
        </li>
        <li>
          Loss of profits, revenue, data, use, goodwill, or other intangible
          losses
        </li>
        <li>
          Damages resulting from:
          <ul>
            <li>Your use or inability to use the Service</li>
            <li>Unauthorized access to or alteration of your data</li>
            <li>
              Any security breaches or vulnerabilities not detected by the
              Service
            </li>
            <li>Any decisions made based on Service outputs</li>
            <li>Any third-party content or conduct on the Service</li>
          </ul>
        </li>
      </ul>
      <p>
        This limitation applies whether the liability is based on contract, tort
        (including negligence), strict liability, or any other legal theory,
        even if advised of the possibility of such damages.
      </p>
      <p>
        <strong>
          Some jurisdictions do not allow certain exclusions or caps; in those
          cases our liability is limited to the fullest extent permitted by law.
        </strong>{" "}
        Nothing in these Terms is intended to exclude liability that cannot
        legally be excluded (for example, certain forms of gross negligence or
        willful misconduct, where applicable).
      </p>

      <h2>5. Usage Rules</h2>
      <p>You agree to:</p>
      <ul>
        <li>
          Use the Service only for lawful purposes and in compliance with these
          Terms
        </li>
        <li>
          Not use the Service to violate any applicable laws or regulations
        </li>
        <li>
          Not attempt to gain unauthorized access to the Service or its
          infrastructure
        </li>
        <li>
          Not interfere with or disrupt the Service or servers/networks
          connected to it
        </li>
        <li>
          Not use automated means (bots, scrapers, etc.) to access the Service
          without express permission
        </li>
        <li>
          Not reverse engineer, decompile, or disassemble any portion of the
          Service
        </li>
        <li>
          Provide accurate and complete information when using the Service
        </li>
        <li>
          Maintain the security and confidentiality of your API keys and
          credentials
        </li>
      </ul>
      <p>
        You agree <strong>not to</strong>:
      </p>
      <ul>
        <li>Use the Service to harm, threaten, or harass others</li>
        <li>
          Upload malicious code or content designed to damage or disrupt systems
        </li>
        <li>
          Attempt to circumvent any rate limits, quotas, or access controls
        </li>
        <li>
          Resell, sublicense, or redistribute the Service without authorization
        </li>
        <li>
          Use the Service in any manner that could damage, disable, or impair
          its functionality
        </li>
      </ul>

      <h2>6. API Usage</h2>
      <p>API access is subject to:</p>
      <ul>
        <li>Rate limits and quotas as documented in the API Terms</li>
        <li>Authentication requirements using organization-scoped API keys</li>
        <li>Tier-based usage caps (free/paid)</li>
      </ul>
      <p>
        Excessive or abusive API usage may result in throttling or access
        suspension without notice.
      </p>

      <h2>7. User Content and Data</h2>
      <p>
        When you submit dependency information, lockfiles, graphs, or other
        Customer Content to the Service:
      </p>
      <ul>
        <li>You retain all ownership rights to your content</li>
        <li>
          You grant MergeSignal a{" "}
          <strong>limited, non-exclusive license</strong> to process, analyze,
          store, and display that content{" "}
          <strong>
            solely to provide, secure, improve, and bill for the Service
          </strong>
          , in accordance with the Privacy Policy (including the restrictions in
          Section 2.1 there)
        </li>
        <li>You represent that you have the right to submit such content</li>
        <li>
          You are responsible for ensuring compliance with applicable data
          protection laws
        </li>
      </ul>
      <p>
        MergeSignal may store inputs and outputs needed to operate the product
        (for example scan results, risk scores, and metadata). See the Privacy
        Policy for categories, retention, and your rights.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        The Service, including its source code, documentation, and branding, is
        licensed under the Apache License 2.0 (see LICENSE file). This means:
      </p>
      <ul>
        <li>
          You may use, modify, and distribute the software as permitted by the
          Apache 2.0 license
        </li>
        <li>
          Certain components may be proprietary and not included in the
          open-source distribution
        </li>
        <li>
          The MergeSignal name and logo are trademarks and may not be used
          without permission
        </li>
      </ul>

      <h2>9. Termination</h2>
      <p>We reserve the right to:</p>
      <ul>
        <li>
          Suspend or terminate your access to the Service at any time, for any
          reason, with or without notice
        </li>
        <li>Terminate these Terms or cease offering the Service at any time</li>
        <li>
          Remove or disable any content or functionality at our discretion
        </li>
      </ul>
      <p>
        You may terminate your use of the Service at any time by ceasing all
        access and use.
      </p>
      <p>Upon termination:</p>
      <ul>
        <li>Your right to access and use the Service immediately ceases</li>
        <li>We may delete your data, including scan results and API keys</li>
        <li>
          Provisions that by their nature should survive termination will
          continue to apply
        </li>
      </ul>

      <h2>10. Changes to Terms</h2>
      <p>
        We may modify these Terms at any time by posting updated Terms on our
        website or in the repository. Your continued use of the Service after
        changes are posted constitutes acceptance of the modified Terms.
      </p>
      <p>Material changes will be notified through:</p>
      <ul>
        <li>Updates published on the MergeSignal website</li>
        <li>Notices in the application interface</li>
        <li>Email notifications (if contact information is available)</li>
      </ul>

      <h2>11. Third-Party Services</h2>
      <p>
        The Service may integrate with or rely on third-party services,
        including:
      </p>
      <ul>
        <li>GitHub API</li>
        <li>npm registry</li>
        <li>OSV vulnerability database</li>
        <li>Package adoption metrics services</li>
      </ul>
      <p>
        Your use of these third-party services is subject to their respective
        terms and policies. We are not responsible for third-party
        services&apos; availability, accuracy, or conduct.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless MergeSignal, its
        operators, and contributors from any claims, damages, losses,
        liabilities, and expenses (including legal fees) arising from:
      </p>
      <ul>
        <li>Your use of the Service</li>
        <li>Your violation of these Terms</li>
        <li>Your violation of any rights of another party</li>
        <li>Any decisions made based on Service outputs</li>
      </ul>

      <h2>13. Disclaimer of accuracy</h2>
      <p>
        This section supplements <strong>Section 3</strong> (nature of analyses
        and no guarantee of specific results).
      </p>
      <p>
        Risk scores, vulnerability information, and recommendations provided by
        the Service:
      </p>
      <ul>
        <li>
          Are generated algorithmically and may not reflect current threats
        </li>
        <li>Should be independently verified before taking action</li>
        <li>May be based on incomplete or outdated data</li>
        <li>Are not guaranteed to detect all security issues</li>
      </ul>
      <p>
        <strong>
          Always perform your own security assessments and follow industry best
          practices.
        </strong>
      </p>

      <h2>14. Governing Law and Dispute Resolution</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction where
        MergeSignal is operated, without regard to conflict of law provisions.
      </p>
      <p>
        Any disputes arising from these Terms or the Service will be resolved
        through:
      </p>
      <ul>
        <li>Good faith negotiations</li>
        <li>Binding arbitration (if required by applicable law)</li>
        <li>Courts in the jurisdiction specified above</li>
      </ul>

      <h2>15. Severability</h2>
      <p>
        If any provision of these Terms is found to be unenforceable or invalid,
        that provision will be limited or eliminated to the minimum extent
        necessary, and the remaining provisions will remain in full force and
        effect.
      </p>

      <h2>16. Entire Agreement</h2>
      <p>
        These Terms, together with the{" "}
        <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/api-terms">API Terms</Link>, constitute the entire
        agreement between you and MergeSignal regarding the Service and
        supersede any prior agreements.
      </p>

      <h2>17. Contact</h2>
      <p>
        For legal inquiries regarding these Terms, please see{" "}
        <Link href="/contact">Contact</Link> or open an issue in the GitHub
        repository.
      </p>

      <hr />

      <p>
        <strong>Last Updated:</strong> March 16, 2026
      </p>
      <p>
        <strong>
          By using MergeSignal, you acknowledge that you have read, understood,
          and agree to be bound by these Terms of Service.
        </strong>
      </p>
    </article>
  );
}
