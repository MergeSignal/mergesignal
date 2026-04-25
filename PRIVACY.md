# Privacy Policy

**Effective Date:** March 16, 2026

## 1. Introduction

This Privacy Policy describes how MergeSignal ("we", "our", or "the Service") collects, uses, stores, and protects information when you use our dependency risk intelligence platform.

By using MergeSignal, you consent to the data practices described in this policy.

## 2. Information We Collect

### 2.1 Restrictions on use of Customer Content

**“Customer Content”** means data you (or an integration on your behalf) submit to operate the Service—for example dependency manifests, lockfiles, structured dependency graphs, repository identifiers, and analysis outputs—not your unrelated private business documents unless you choose to upload them.

For the **official hosted Service** (and consistent with how self-hosted operators should treat their users’ data), MergeSignal **does not**:

- **Sell** Customer Content or scan inputs to data brokers or unrelated third parties;
- use Customer Content to **train generalized machine-learning models for unrelated third parties** (for example, selling embeddings or corpora derived from your repositories to model vendors); or
- use Customer Content for any purpose **other than** providing, securing, improving, and billing for the Service as described in this Policy and in the Terms of Service.

**Improvements to the Service** may use **aggregated, de-identified** statistics (for example, overall scan volume or error rates), security and abuse signals, and product telemetry that does not reproduce your confidential inputs. Where optional features need richer feedback, we will describe that in-product or in this Policy.

**What we persist:** The Service stores what is needed to run analyses and show history—typically repository identifiers, **lockfile or manifest-derived inputs** you supply (or that the GitHub App sends for changed paths), structured dependency summaries, **analysis results** (scores, signals, recommendations), quotas, and audit-relevant metadata. We do **not** operate the standard product as a bulk mirror of your **private application source code tree** (for example every `.ts` / `.go` file in the repo); if a feature ever ingests more than dependency-oriented inputs, that feature’s documentation will say so explicitly.

### 2.2 Information You Provide

When using the Service, you may provide:

- **Repository information**: Repository names, owner identifiers, dependency graphs, and lockfile contents
- **API credentials**: API keys and authentication tokens (securely hashed and stored)
- **GitHub data**: If using the GitHub App integration, we receive repository metadata, pull request information, and webhook events
- **Organization data**: Organization identifiers and settings for multi-tenant usage

### 2.3 Automatically Collected Information

We automatically collect:

- **Usage data**: API requests, endpoint access patterns, scan frequency, and feature usage
- **Technical data**: IP addresses, request headers, user agents, and request identifiers
- **Performance data**: Response times, error rates, and system metrics
- **Scan results**: Risk scores, detected signals, vulnerability information, and analysis outputs

### 2.4 Third-Party Data

We may collect data from third-party sources to enrich analysis:

- **npm registry**: Package metadata, download statistics, and maintainer information
- **OSV vulnerability database**: CVE and advisory information for known vulnerabilities
- **GitHub API**: Repository health metrics, issue counts, and maintainer activity (if enabled)

## 3. How We Use Your Information

We use collected information to:

- **Provide the Service**: Analyze dependencies, calculate risk scores, and generate recommendations
- **Improve the Service (within the limits of Section 2.1)**: Tune heuristics, fix bugs, and build **aggregate** product insights—without selling Customer Content or using it to train third-party foundation models as described above
- **Maintain security**: Monitor for abuse, prevent unauthorized access, and protect infrastructure
- **Optimize performance**: Identify bottlenecks, improve response times, and scale resources
- **Communicate updates**: Notify you of important changes, security issues, or service disruptions
- **Enforce policies**: Apply rate limits, quotas, and tier-based restrictions
- **Generate analytics**: Create aggregate, anonymized statistics about platform usage

## 4. Data Storage and Retention

### 4.1 Where Data is Stored

Your data is stored in:

- **PostgreSQL database**: Scan status, scores, **analysis results (JSON)**, repository/org identifiers, policies, alerts, and related metadata—**not** a wholesale copy of your application source tree unless you have uploaded such content as part of a documented feature
- **Redis cache**: Temporary job queues, session data, and cached API responses (transient; see retention below)
- **Application logs**: Request logs, error logs, and audit trails

### 4.2 Data Retention

We retain data as follows:

- **Scan results**: Retained indefinitely unless explicitly deleted by the user
- **API keys**: Retained until revoked or the organization is deleted
- **Request logs**: Retained for 90 days for debugging and security monitoring
- **Job queue data**: Retained for 7 days after job completion
- **Cached data**: Retained according to TTL settings (typically 1-24 hours)

You may request deletion of your data by contacting us (see Section 10).

## 5. Data Sharing and Disclosure

### 5.1 We Do Not Sell Your Data

We do not sell, rent, or trade your personal information or scan data to third parties.

### 5.2 Third-Party Services

We may share limited data with third-party services necessary for operation:

- **Cloud infrastructure providers**: For hosting databases, APIs, and worker processes
- **Monitoring services**: For error tracking, performance monitoring, and uptime alerts
- **External APIs**: Package registries, vulnerability databases, and code hosting platforms (only data necessary for analysis)

These third parties are bound by confidentiality obligations and may only use data to provide services to us.

### 5.3 Legal Requirements

We may disclose information if required to:

- Comply with applicable laws, regulations, or legal processes
- Respond to lawful requests from government authorities
- Enforce our Terms of Service or protect our rights
- Prevent fraud, abuse, or security threats
- Protect the safety and rights of users or the public

### 5.4 Business Transfers

In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity. We will notify you of any such change and provide options regarding your data.

## 6. Data Security

We implement reasonable security measures to protect your data:

- **Encryption**: Data in transit is encrypted using TLS/HTTPS; sensitive data at rest is encrypted
- **Access controls**: Role-based access, API key authentication, and principle of least privilege
- **Secure storage**: Hashed passwords/keys, secure database configurations, and isolated environments
- **Monitoring**: Continuous security monitoring, intrusion detection, and audit logging
- **Regular updates**: Timely security patches and dependency updates

**However**, no method of transmission or storage is 100% secure. We cannot promise absolute security; we nonetheless implement the controls in this Policy in **good faith** and work to address identified issues promptly.

## 7. Your Rights and Choices

Depending on your jurisdiction, you may have the following rights:

### 7.1 Access and Portability

- Request a copy of the data we hold about you
- Receive your data in a structured, machine-readable format (e.g., JSON export of scan results)

### 7.2 Correction and Deletion

- Correct inaccurate or incomplete information
- Request deletion of your data ("right to be forgotten")

### 7.3 Restriction and Objection

- Restrict processing of your data for specific purposes
- Object to processing based on legitimate interests

### 7.4 Withdraw Consent

- Withdraw consent for data processing at any time (may limit Service functionality)

### 7.5 API Key Management

- Generate, revoke, or rotate API keys at any time
- View API key usage and access logs

To exercise these rights, contact us using the information in Section 10.

## 8. International Data Transfers

If you access the Service from outside the jurisdiction where our servers are located, your information may be transferred to and processed in other countries. We take steps to ensure adequate protection through:

- Standard contractual clauses (where applicable)
- Compliance with applicable data protection frameworks
- Security measures equivalent to those in your jurisdiction

## 9. GDPR Compliance (for EU/EEA Users)

If you are located in the European Union or European Economic Area, you have additional rights under the General Data Protection Regulation (GDPR):

### 9.1 Legal Basis for Processing

We process your data based on:

- **Contractual necessity**: To provide the Service as agreed in the Terms of Service
- **Legitimate interests**: To improve the Service, prevent abuse, and ensure security
- **Consent**: Where you have explicitly provided consent (e.g., optional features)
- **Legal obligations**: To comply with applicable laws

### 9.2 Data Protection Officer

For GDPR-related inquiries, contact our Data Protection Officer (see Section 10).

### 9.3 Supervisory Authority

You have the right to lodge a complaint with your local data protection supervisory authority if you believe your data has been mishandled.

## 10. Contact and Data Requests

For privacy-related inquiries, data access requests, or to exercise your rights, contact us at:

- **Email**: See CONTACT.md for contact information
- **GitHub**: Open a confidential issue in the repository (for non-sensitive inquiries)

We will respond to requests within 30 days (or as required by applicable law).

## 11. Children's Privacy

The Service is not intended for users under the age of 16 (or the age of digital consent in your jurisdiction). We do not knowingly collect information from children. If you believe we have collected data from a child, contact us immediately, and we will delete it.

## 12. Cookies and Tracking

The Service uses minimal tracking technologies:

- **Session cookies**: For authentication and maintaining user sessions
- **Local storage**: For storing UI preferences and API keys (client-side only)
- **Logs**: IP addresses and request headers for security and debugging

We do **not** use:

- Third-party advertising or analytics cookies
- Cross-site tracking or behavioral profiling
- Persistent identifiers beyond what is necessary for Service operation

## 13. Open Source Considerations

MergeSignal includes open-source components under the **Apache License, Version 2.0** (see the `LICENSE` and `NOTICE` files). When using the open-source components:

- You are responsible for data handling in your own deployment
- Self-hosted instances are not covered by this Privacy Policy
- You must create your own privacy policy if offering the Service to others

This Privacy Policy applies to the official hosted instance of MergeSignal.

## 14. Changes to This Policy

We may update this Privacy Policy periodically. Changes will be notified through:

- Updates to the GitHub repository with commit history
- Notices in the application interface
- Email notifications (if contact information is available)

Continued use of the Service after changes constitutes acceptance of the updated policy. Material changes will include a revised "Effective Date" at the top of this document.

## 15. California Privacy Rights (CCPA)

If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):

- **Right to know**: What personal information is collected and how it is used
- **Right to delete**: Request deletion of your personal information
- **Right to opt-out**: Opt-out of the "sale" of personal information (note: we do not sell data)
- **Right to non-discrimination**: Equal service regardless of privacy choices

To exercise these rights, contact us using the information in Section 10.

## 16. Data Breach Notification

In the event of a data breach that may affect your information, we will:

- Notify affected users within 72 hours (or as required by law)
- Describe the nature of the breach and affected data
- Provide recommendations for protective measures
- Notify relevant supervisory authorities as required

---

**Last Updated:** March 16, 2026

**For questions about this Privacy Policy, please see CONTACT.md.**
