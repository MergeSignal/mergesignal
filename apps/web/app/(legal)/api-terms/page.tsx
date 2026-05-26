import type { Metadata } from "next";
import Link from "next/link";

import docStyles from "../../components/shared/DocArticle/DocArticle.module.css";

export const metadata: Metadata = {
  title: "API Terms - MergeSignal",
  description:
    "API rate limits, quotas, authentication, and acceptable use for the MergeSignal API.",
};

export default function ApiTermsPage() {
  return (
    <article className={docStyles.article}>
      <h1>API Terms of Service</h1>
      <p>
        <strong>Effective Date:</strong> March 16, 2026
      </p>
      <p>
        These API Terms supplement the main{" "}
        <Link href="/terms">Terms of Service</Link> and govern your use of the
        MergeSignal API.
      </p>

      <h2>1. API Access and Authentication</h2>

      <h3>1.1 API Keys</h3>
      <ul>
        <li>API access requires organization-scoped API keys</li>
        <li>
          Each API key is tied to a specific organization (<code>owner</code>)
        </li>
        <li>
          You are responsible for keeping your API keys secure and confidential
        </li>
        <li>
          API keys must not be shared, embedded in public repositories, or
          exposed in client-side code
        </li>
        <li>Lost or compromised keys should be revoked immediately</li>
      </ul>

      <h3>1.2 Authentication</h3>
      <p>All authenticated API requests must include:</p>
      <pre>
        <code>{`Authorization: Bearer ms_<your_api_key>`}</code>
      </pre>
      <p>
        Requests without proper authentication will receive a{" "}
        <code>401 Unauthorized</code> response.
      </p>

      <h3>1.3 Key Management</h3>
      <p>You may:</p>
      <ul>
        <li>Generate multiple API keys per organization</li>
        <li>Revoke keys at any time using the provided CLI tools</li>
        <li>Rotate keys for security best practices</li>
      </ul>
      <p>We reserve the right to:</p>
      <ul>
        <li>Revoke API keys for violations of these Terms</li>
        <li>Invalidate compromised or leaked keys without notice</li>
        <li>Require key rotation for security reasons</li>
      </ul>

      <h2>2. Rate Limits and Quotas</h2>

      <h3>2.1 Rate Limiting</h3>
      <p>
        The API enforces rate limits to ensure fair usage and system stability:
      </p>
      <ul>
        <li>
          <strong>Global rate limit</strong>: 100 requests per minute per IP
          address (adjustable)
        </li>
        <li>
          <strong>Authenticated rate limit</strong>: Higher limits based on
          organization tier
        </li>
        <li>
          <strong>Endpoint-specific limits</strong>: May vary by endpoint and
          operation
        </li>
      </ul>
      <p>When rate limits are exceeded:</p>
      <ul>
        <li>
          You will receive a <code>429 Too Many Requests</code> response
        </li>
        <li>
          The <code>Retry-After</code> header indicates when to retry
        </li>
        <li>
          Repeated violations may result in temporary or permanent suspension
        </li>
      </ul>

      <h3>2.2 Tier-Based Quotas</h3>
      <p>API usage is subject to tier-based quotas:</p>
      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Scans</th>
            <th>PR Comments</th>
            <th>Alerts</th>
            <th>Policies</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Free</td>
            <td>
              Per-owner rolling 24h caps (GitHub-sourced vs other scans are
              limited separately; defaults are conservative)
            </td>
            <td>Opt-in</td>
            <td>500</td>
            <td>50</td>
          </tr>
          <tr>
            <td>Paid</td>
            <td>Unlimited*</td>
            <td>Enabled</td>
            <td>10,000</td>
            <td>500</td>
          </tr>
        </tbody>
      </table>
      <p>
        <em>*Subject to fair use policy</em>
      </p>
      <p>
        Exact free-tier scan caps are enforced by the API deployment
        (environment configuration) and may change; when exceeded, new scans
        return <code>429</code> until the rolling window resets.
      </p>
      <p>When quotas are exceeded:</p>
      <ul>
        <li>
          Additional requests return <code>429 Quota Exceeded</code>
        </li>
        <li>Upgrade to a higher tier or wait for quota reset (monthly)</li>
      </ul>

      <h3>2.3 Fair Use Policy</h3>
      <p>Even for paid tiers, we enforce fair use to prevent abuse:</p>
      <ul>
        <li>No sustained request rates exceeding reasonable use patterns</li>
        <li>No automated bulk scanning without prior approval</li>
        <li>No benchmarking or load testing without permission</li>
        <li>No using the API to build competing services</li>
      </ul>
      <p>Violations may result in throttling, suspension, or termination.</p>

      <h2>3. Prohibited Uses</h2>
      <p>
        You must <strong>not</strong> use the API to:
      </p>

      <h3>3.1 Abusive Behavior</h3>
      <ul>
        <li>
          Launch denial-of-service (DoS) or distributed denial-of-service (DDoS)
          attacks
        </li>
        <li>Overwhelm the system with excessive requests</li>
        <li>Intentionally submit malformed or malicious data</li>
        <li>Probe for vulnerabilities or security weaknesses</li>
      </ul>

      <h3>3.2 Unauthorized Access</h3>
      <ul>
        <li>
          Access data belonging to other organizations without authorization
        </li>
        <li>Attempt to bypass authentication or authorization mechanisms</li>
        <li>Share API keys across organizations or users</li>
        <li>Impersonate other users or organizations</li>
      </ul>

      <h3>3.3 Scraping and Data Mining</h3>
      <ul>
        <li>Systematically download or mirror API data</li>
        <li>Use automated bots or scrapers without permission</li>
        <li>
          Build datasets or training data from API responses (unless authorized)
        </li>
        <li>Resell or redistribute API data</li>
      </ul>

      <h3>3.4 Reverse Engineering</h3>
      <ul>
        <li>Reverse engineer upgrade impact analysis algorithms</li>
        <li>Decompile or disassemble proprietary components</li>
        <li>Attempt to extract trade secrets or confidential information</li>
      </ul>

      <h3>3.5 Illegal Activities</h3>
      <ul>
        <li>Violate any applicable laws or regulations</li>
        <li>Infringe on intellectual property rights</li>
        <li>Distribute malware, viruses, or harmful code</li>
        <li>Engage in fraudulent or deceptive practices</li>
      </ul>

      <h2>4. API Usage Obligations</h2>

      <h3>4.1 Compliance</h3>
      <p>You agree to:</p>
      <ul>
        <li>
          Use the API in compliance with these Terms and the main Terms of
          Service
        </li>
        <li>Respect rate limits and quotas</li>
        <li>Handle API keys securely</li>
        <li>Implement proper error handling and retry logic</li>
        <li>Cache responses appropriately to reduce unnecessary requests</li>
        <li>Monitor your usage and stay within allocated limits</li>
      </ul>

      <h3>4.2 Attribution</h3>
      <p>When displaying results from the API:</p>
      <ul>
        <li>Clearly indicate that analysis is provided by MergeSignal</li>
        <li>
          Include disclaimers that results are informational and should be
          validated
        </li>
        <li>
          Link back to the official MergeSignal documentation or website
          (optional but appreciated)
        </li>
      </ul>

      <h3>4.3 Error Handling</h3>
      <p>Your application should:</p>
      <ul>
        <li>Handle API errors gracefully (4xx and 5xx responses)</li>
        <li>Implement exponential backoff for retries</li>
        <li>
          Respect <code>Retry-After</code> headers
        </li>
        <li>
          Not automatically retry on <code>4xx</code> client errors (except{" "}
          <code>429</code>)
        </li>
      </ul>

      <h2>5. API Availability and Uptime</h2>

      <h3>5.1 Service Level</h3>
      <p>
        The API is provided on a <strong>best-effort basis</strong> with no
        guaranteed uptime or availability:
      </p>
      <ul>
        <li>We aim for high availability but do not guarantee 100% uptime</li>
        <li>
          Scheduled maintenance will be announced in advance when possible
        </li>
        <li>Emergency maintenance may occur without notice</li>
      </ul>

      <h3>5.2 Downtime and Interruptions</h3>
      <p>We are not liable for:</p>
      <ul>
        <li>Service interruptions, downtime, or degraded performance</li>
        <li>Data loss due to system failures</li>
        <li>Third-party service failures (GitHub, npm, OSV, etc.)</li>
        <li>Force majeure events (natural disasters, network outages, etc.)</li>
      </ul>

      <h3>5.3 API Changes</h3>
      <p>We may modify the API at any time:</p>
      <ul>
        <li>
          Breaking changes will be versioned and announced in advance (when
          feasible)
        </li>
        <li>
          Deprecated endpoints will have a sunset period of at least 90 days
        </li>
        <li>New features may be added without notice</li>
        <li>Rate limits and quotas may be adjusted based on system load</li>
      </ul>
      <p>Monitor the GitHub repository and API documentation for updates.</p>

      <h2>6. Data and Privacy</h2>

      <h3>6.1 Data Submitted via API</h3>
      <p>When submitting data to the API:</p>
      <ul>
        <li>You represent that you have the right to submit such data</li>
        <li>You retain ownership of your data</li>
        <li>
          You grant MergeSignal a <strong>limited</strong> license to process
          and store data{" "}
          <strong>
            solely to provide, secure, improve, and bill for the Service
          </strong>
          , as described in the <Link href="/privacy">Privacy Policy</Link>{" "}
          (including Customer Content restrictions)
        </li>
        <li>
          Sensitive data (secrets, credentials, unnecessary PII) should not be
          included in API requests
        </li>
      </ul>

      <h3>6.2 Data Retention</h3>
      <p>
        API-submitted data is retained as described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>:
      </p>
      <ul>
        <li>Scan results: Retained indefinitely unless deleted</li>
        <li>Request logs: Retained for 90 days</li>
        <li>Job queue data: Retained for 7 days after completion</li>
      </ul>

      <h3>6.3 API Responses</h3>
      <p>API responses may include:</p>
      <ul>
        <li>Risk scores and analysis results</li>
        <li>Vulnerability information from third-party databases</li>
        <li>Package metadata from public registries</li>
        <li>Aggregated benchmarking data</li>
      </ul>
      <p>
        This data should be validated; automated outputs may be incomplete or
        wrong-see the Terms of Service, Section 3.
      </p>

      <h2>7. Access Revocation and Suspension</h2>

      <h3>7.1 Immediate Revocation</h3>
      <p>
        We reserve the right to immediately revoke or suspend API access for:
      </p>
      <ul>
        <li>Violations of these API Terms or the main Terms of Service</li>
        <li>Abusive behavior or excessive usage</li>
        <li>Security threats or suspicious activity</li>
        <li>Legal requirements or law enforcement requests</li>
        <li>Non-payment (for paid tiers)</li>
      </ul>

      <h3>7.2 Notice</h3>
      <p>
        When possible, we will provide notice before suspending access, except
        in cases of:
      </p>
      <ul>
        <li>Imminent security threats</li>
        <li>Ongoing abuse or attacks</li>
        <li>Legal obligations</li>
      </ul>

      <h3>7.3 Appeals</h3>
      <p>If your access is revoked, you may:</p>
      <ul>
        <li>Contact us to understand the reason</li>
        <li>Appeal the decision with supporting evidence</li>
        <li>Request reinstatement after addressing violations</li>
      </ul>
      <p>Reinstatement is at our sole discretion.</p>

      <h2>8. Support and Documentation</h2>

      <h3>8.1 API Documentation</h3>
      <p>API documentation is available at:</p>
      <ul>
        <li>
          <strong>OpenAPI Spec</strong>: <code>GET /openapi.json</code>
        </li>
        <li>
          <strong>Interactive Docs</strong>: <code>GET /docs</code>
        </li>
        <li>
          <strong>README</strong>: GitHub repository documentation
        </li>
      </ul>

      <h3>8.2 Support Channels</h3>
      <p>For API support:</p>
      <ul>
        <li>
          <strong>Documentation</strong>: Check the official docs first
        </li>
        <li>
          <strong>GitHub Issues</strong>: Report bugs or request features
        </li>
        <li>
          <strong>Email</strong>: Contact us for critical issues (see{" "}
          <Link href="/contact">Contact</Link>)
        </li>
      </ul>
      <p>
        Support is provided on a best-effort basis with no guaranteed response
        time.
      </p>

      <h3>8.3 No Service Level Agreement (SLA)</h3>
      <p>Unless you have a separate written agreement, we do not provide:</p>
      <ul>
        <li>Guaranteed uptime percentages</li>
        <li>Response time commitments</li>
        <li>Dedicated support channels</li>
        <li>Priority handling for issues</li>
      </ul>

      <h2>9. Billing and Payment (Paid Tiers)</h2>

      <h3>9.1 Subscription</h3>
      <p>Paid tier access requires:</p>
      <ul>
        <li>Valid payment information</li>
        <li>Monthly or annual subscription commitment</li>
        <li>Acceptance of billing terms</li>
      </ul>

      <h3>9.2 Payment Obligations</h3>
      <p>You agree to:</p>
      <ul>
        <li>Pay all fees as specified for your tier</li>
        <li>Provide accurate billing information</li>
        <li>Notify us of payment method changes</li>
        <li>Pay any applicable taxes</li>
      </ul>

      <h3>9.3 Refunds</h3>
      <p>Fees are generally non-refundable except:</p>
      <ul>
        <li>Service outages exceeding thresholds (if SLA is provided)</li>
        <li>Billing errors on our part</li>
        <li>As required by applicable law</li>
      </ul>

      <h3>9.4 Non-Payment</h3>
      <p>Failure to pay may result in:</p>
      <ul>
        <li>Suspension or downgrade to free tier</li>
        <li>Loss of access to paid features</li>
        <li>Termination of API access</li>
      </ul>

      <h2>10. Intellectual Property</h2>

      <h3>10.1 API License</h3>
      <p>
        The API is licensed under Apache 2.0 for open-source components.
        Proprietary components remain the intellectual property of MergeSignal.
      </p>

      <h3>10.2 Your Applications</h3>
      <p>
        You retain all rights to applications built using the API, provided they
        comply with these Terms.
      </p>

      <h3>10.3 Trademarks</h3>
      <p>The MergeSignal name and logo are trademarks. You may not:</p>
      <ul>
        <li>Use our trademarks without permission</li>
        <li>Imply endorsement or affiliation without authorization</li>
        <li>Create confusingly similar branding</li>
      </ul>

      <h2>11. Disclaimers and limitation of liability</h2>

      <h3>11.1 API outputs and availability</h3>
      <p>
        The API is provided with the <strong>commitments and limits</strong> in
        the Privacy Policy and Terms of Service (including Section 3 there). We{" "}
        <strong>do not guarantee</strong> that responses will be complete,
        timely, or free of error; that every vulnerability will be surfaced;
        that the API will be uninterrupted; or that results will fit any
        particular compliance regime. You should validate material decisions
        independently.
      </p>

      <h3>11.2 Limitation of liability</h3>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR:</p>
      <ul>
        <li>Indirect, incidental, or consequential damages</li>
        <li>Loss of profits, data, or business opportunities</li>
        <li>Damages from API downtime or errors</li>
        <li>Third-party services or integrations</li>
        <li>Decisions made based on API outputs</li>
      </ul>
      <p>
        See the main Terms of Service (including jurisdiction-specific caps
        where applicable).
      </p>

      <h2>12. Indemnification</h2>
      <p>You agree to indemnify MergeSignal from claims arising from:</p>
      <ul>
        <li>Your use of the API</li>
        <li>Violations of these API Terms</li>
        <li>Infringement of third-party rights</li>
        <li>Any harm caused by your applications or services</li>
      </ul>

      <h2>13. Changes to API Terms</h2>
      <p>
        We may update these API Terms at any time. Changes will be posted on the
        MergeSignal website with an updated &quot;Effective Date.&quot;
        Continued use of the API after changes constitutes acceptance.
      </p>

      <h2>14. Termination</h2>
      <p>You may terminate API usage by:</p>
      <ul>
        <li>Revoking all API keys</li>
        <li>Ceasing all API requests</li>
        <li>Canceling any paid subscriptions</li>
      </ul>
      <p>We may terminate API access as described in Section 7.</p>

      <h2>15. Contact</h2>
      <p>For API-related inquiries, contact us at:</p>
      <ul>
        <li>
          <strong>GitHub Issues</strong>: For technical questions and bug
          reports
        </li>
        <li>
          <strong>Email</strong>: See <Link href="/contact">Contact</Link> for
          legal or billing inquiries
        </li>
      </ul>

      <hr />

      <p>
        <strong>Last Updated:</strong> March 16, 2026
      </p>
      <p>
        <strong>
          By using the MergeSignal API, you acknowledge that you have read,
          understood, and agree to be bound by these API Terms and the main
          Terms of Service.
        </strong>
      </p>
    </article>
  );
}
