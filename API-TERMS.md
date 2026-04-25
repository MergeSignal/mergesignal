# API Terms of Service

**Effective Date:** March 16, 2026

These API Terms supplement the main Terms of Service (TERMS.md) and govern your use of the MergeSignal API.

## 1. API Access and Authentication

### 1.1 API Keys

- API access requires organization-scoped API keys
- Each API key is tied to a specific organization (`owner`)
- You are responsible for keeping your API keys secure and confidential
- API keys must not be shared, embedded in public repositories, or exposed in client-side code
- Lost or compromised keys should be revoked immediately

### 1.2 Authentication

All authenticated API requests must include:

```
Authorization: Bearer ms_<your_api_key>
```

Requests without proper authentication will receive a `401 Unauthorized` response.

### 1.3 Key Management

You may:

- Generate multiple API keys per organization
- Revoke keys at any time using the provided CLI tools
- Rotate keys for security best practices

We reserve the right to:

- Revoke API keys for violations of these Terms
- Invalidate compromised or leaked keys without notice
- Require key rotation for security reasons

## 2. Rate Limits and Quotas

### 2.1 Rate Limiting

The API enforces rate limits to ensure fair usage and system stability:

- **Global rate limit**: 100 requests per minute per IP address (adjustable)
- **Authenticated rate limit**: Higher limits based on organization tier
- **Endpoint-specific limits**: May vary by endpoint and operation

When rate limits are exceeded:

- You will receive a `429 Too Many Requests` response
- The `Retry-After` header indicates when to retry
- Repeated violations may result in temporary or permanent suspension

### 2.2 Tier-Based Quotas

API usage is subject to tier-based quotas:

| Tier | Scans                                                                                                        | PR Comments | Alerts | Policies |
| ---- | ------------------------------------------------------------------------------------------------------------ | ----------- | ------ | -------- |
| Free | Per-owner rolling 24h caps (GitHub-sourced vs other scans are limited separately; defaults are conservative) | Opt-in      | 500    | 50       |
| Paid | Unlimited\*                                                                                                  | Enabled     | 10,000 | 500      |

_\*Subject to fair use policy_

Exact free-tier scan caps are enforced by the API deployment (environment configuration) and may change; when exceeded, new scans return `429` until the rolling window resets.

When quotas are exceeded:

- Additional requests return `429 Quota Exceeded`
- Upgrade to a higher tier or wait for quota reset (monthly)

### 2.3 Fair Use Policy

Even for paid tiers, we enforce fair use to prevent abuse:

- No sustained request rates exceeding reasonable use patterns
- No automated bulk scanning without prior approval
- No benchmarking or load testing without permission
- No using the API to build competing services

Violations may result in throttling, suspension, or termination.

## 3. Prohibited Uses

You must **not** use the API to:

### 3.1 Abusive Behavior

- Launch denial-of-service (DoS) or distributed denial-of-service (DDoS) attacks
- Overwhelm the system with excessive requests
- Intentionally submit malformed or malicious data
- Probe for vulnerabilities or security weaknesses

### 3.2 Unauthorized Access

- Access data belonging to other organizations without authorization
- Attempt to bypass authentication or authorization mechanisms
- Share API keys across organizations or users
- Impersonate other users or organizations

### 3.3 Scraping and Data Mining

- Systematically download or mirror API data
- Use automated bots or scrapers without permission
- Build datasets or training data from API responses (unless authorized)
- Resell or redistribute API data

### 3.4 Reverse Engineering

- Reverse engineer risk scoring algorithms
- Decompile or disassemble proprietary components
- Attempt to extract trade secrets or confidential information

### 3.5 Illegal Activities

- Violate any applicable laws or regulations
- Infringe on intellectual property rights
- Distribute malware, viruses, or harmful code
- Engage in fraudulent or deceptive practices

## 4. API Usage Obligations

### 4.1 Compliance

You agree to:

- Use the API in compliance with these Terms and the main Terms of Service
- Respect rate limits and quotas
- Handle API keys securely
- Implement proper error handling and retry logic
- Cache responses appropriately to reduce unnecessary requests
- Monitor your usage and stay within allocated limits

### 4.2 Attribution

When displaying results from the API:

- Clearly indicate that analysis is provided by MergeSignal
- Include disclaimers that results are informational and should be validated
- Link back to the official MergeSignal documentation or website (optional but appreciated)

### 4.3 Error Handling

Your application should:

- Handle API errors gracefully (4xx and 5xx responses)
- Implement exponential backoff for retries
- Respect `Retry-After` headers
- Not automatically retry on `4xx` client errors (except `429`)

## 5. API Availability and Uptime

### 5.1 Service Level

The API is provided on a **best-effort basis** with no guaranteed uptime or availability:

- We aim for high availability but do not guarantee 100% uptime
- Scheduled maintenance will be announced in advance when possible
- Emergency maintenance may occur without notice

### 5.2 Downtime and Interruptions

We are not liable for:

- Service interruptions, downtime, or degraded performance
- Data loss due to system failures
- Third-party service failures (GitHub, npm, OSV, etc.)
- Force majeure events (natural disasters, network outages, etc.)

### 5.3 API Changes

We may modify the API at any time:

- Breaking changes will be versioned and announced in advance (when feasible)
- Deprecated endpoints will have a sunset period of at least 90 days
- New features may be added without notice
- Rate limits and quotas may be adjusted based on system load

Monitor the GitHub repository and API documentation for updates.

## 6. Data and Privacy

### 6.1 Data Submitted via API

When submitting data to the API:

- You represent that you have the right to submit such data
- You retain ownership of your data
- You grant MergeSignal a **limited** license to process and store data **solely to provide, secure, improve, and bill for the Service**, as described in the Privacy Policy (including Customer Content restrictions)
- Sensitive data (secrets, credentials, unnecessary PII) should not be included in API requests

### 6.2 Data Retention

API-submitted data is retained as described in the Privacy Policy:

- Scan results: Retained indefinitely unless deleted
- Request logs: Retained for 90 days
- Job queue data: Retained for 7 days after completion

### 6.3 API Responses

API responses may include:

- Risk scores and analysis results
- Vulnerability information from third-party databases
- Package metadata from public registries
- Aggregated benchmarking data

This data should be validated; automated outputs may be incomplete or wrong—see the Terms of Service, Section 3.

## 7. Access Revocation and Suspension

### 7.1 Immediate Revocation

We reserve the right to immediately revoke or suspend API access for:

- Violations of these API Terms or the main Terms of Service
- Abusive behavior or excessive usage
- Security threats or suspicious activity
- Legal requirements or law enforcement requests
- Non-payment (for paid tiers)

### 7.2 Notice

When possible, we will provide notice before suspending access, except in cases of:

- Imminent security threats
- Ongoing abuse or attacks
- Legal obligations

### 7.3 Appeals

If your access is revoked, you may:

- Contact us to understand the reason
- Appeal the decision with supporting evidence
- Request reinstatement after addressing violations

Reinstatement is at our sole discretion.

## 8. Support and Documentation

### 8.1 API Documentation

API documentation is available at:

- **OpenAPI Spec**: `GET /openapi.json`
- **Interactive Docs**: `GET /docs`
- **README**: GitHub repository documentation

### 8.2 Support Channels

For API support:

- **Documentation**: Check the official docs first
- **GitHub Issues**: Report bugs or request features
- **Email**: Contact us for critical issues (see CONTACT.md)

Support is provided on a best-effort basis with no guaranteed response time.

### 8.3 No Service Level Agreement (SLA)

Unless you have a separate written agreement, we do not provide:

- Guaranteed uptime percentages
- Response time commitments
- Dedicated support channels
- Priority handling for issues

## 9. Billing and Payment (Paid Tiers)

### 9.1 Subscription

Paid tier access requires:

- Valid payment information
- Monthly or annual subscription commitment
- Acceptance of billing terms

### 9.2 Payment Obligations

You agree to:

- Pay all fees as specified for your tier
- Provide accurate billing information
- Notify us of payment method changes
- Pay any applicable taxes

### 9.3 Refunds

Fees are generally non-refundable except:

- Service outages exceeding thresholds (if SLA is provided)
- Billing errors on our part
- As required by applicable law

### 9.4 Non-Payment

Failure to pay may result in:

- Suspension or downgrade to free tier
- Loss of access to paid features
- Termination of API access

## 10. Intellectual Property

### 10.1 API License

The API is licensed under Apache 2.0 for open-source components. Proprietary components remain the intellectual property of MergeSignal.

### 10.2 Your Applications

You retain all rights to applications built using the API, provided they comply with these Terms.

### 10.3 Trademarks

The MergeSignal name and logo are trademarks. You may not:

- Use our trademarks without permission
- Imply endorsement or affiliation without authorization
- Create confusingly similar branding

## 11. Disclaimers and limitation of liability

### 11.1 API outputs and availability

The API is provided with the **commitments and limits** in the Privacy Policy and Terms of Service (including Section 3 there). We **do not guarantee** that responses will be complete, timely, or free of error; that every vulnerability will be surfaced; that the API will be uninterrupted; or that results will fit any particular compliance regime. You should validate material decisions independently.

### 11.2 Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR:

- Indirect, incidental, or consequential damages
- Loss of profits, data, or business opportunities
- Damages from API downtime or errors
- Third-party services or integrations
- Decisions made based on API outputs

See the main Terms of Service (including jurisdiction-specific caps where applicable).

## 12. Indemnification

You agree to indemnify MergeSignal from claims arising from:

- Your use of the API
- Violations of these API Terms
- Infringement of third-party rights
- Any harm caused by your applications or services

## 13. Changes to API Terms

We may update these API Terms at any time. Changes will be posted in the GitHub repository with an updated "Effective Date." Continued use of the API after changes constitutes acceptance.

## 14. Termination

You may terminate API usage by:

- Revoking all API keys
- Ceasing all API requests
- Canceling any paid subscriptions

We may terminate API access as described in Section 7.

## 15. Contact

For API-related inquiries, contact us at:

- **GitHub Issues**: For technical questions and bug reports
- **Email**: See CONTACT.md for legal or billing inquiries

---

**Last Updated:** March 16, 2026

**By using the MergeSignal API, you acknowledge that you have read, understood, and agree to be bound by these API Terms and the main Terms of Service.**
