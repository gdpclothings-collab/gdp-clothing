# Security Incident Response Policy

## Scope
Applies to suspected or confirmed unauthorized access, credential exposure, customer-data disclosure, malicious uploads, payment compromise, service abuse, production tampering and privacy breaches.

## Workflow
1. **Detect & record** — create an incident record with time, system, severity and initial evidence.
2. **Contain** — revoke/rotate credentials, block abusive traffic, disable vulnerable functionality or isolate affected access where appropriate.
3. **Preserve evidence** — retain relevant logs, timestamps, affected identifiers and configuration state. Do not collect unnecessary customer data.
4. **Investigate** — determine entry point, scope, affected systems, affected individuals and whether personal information was involved.
5. **Privacy assessment** — assess whether the incident creates a real risk of significant harm and document the reasoning.
6. **Notify/report when required** — follow applicable legal notification/reporting obligations and provide meaningful information to affected individuals when required.
7. **Recover** — patch the issue, restore trustworthy service, validate access controls and monitor for recurrence.
8. **Post-incident review** — document root cause, corrective actions, owners and completion evidence.

## Severity
- Critical: active compromise, payment/credential exposure, broad customer-data access.
- High: confirmed unauthorized access or significant control failure.
- Medium: limited security event requiring remediation but no evidence of major compromise.
- Low: suspicious or policy event with minimal impact.

All security incidents and privacy breaches are documented even when external notification is not required.
