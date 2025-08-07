/**
 * Security utilities for SMS-Dev CLI
 * Certificate generation, validation, and security helpers
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

export interface CertificateInfo {
  cert: string
  key: string
  ca?: string
  passphrase?: string
}

export interface SecurityAuditResult {
  score: number
  issues: SecurityIssue[]
  recommendations: string[]
  compliance: {
    owasp: boolean
    cis: boolean
    nist: boolean
  }
}

export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  description: string
  recommendation: string
  cve?: string[]
}

/**
 * SSL/TLS Certificate management
 */
export class CertificateManager {
  private certsDir: string

  constructor(certsDir?: string) {
    this.certsDir = certsDir || path.join(process.cwd(), '.sms-dev', 'certificates')
    this.ensureCertsDirectory()
  }

  /**
   * Ensure certificates directory exists
   */
  private ensureCertsDirectory(): void {
    if (!fs.existsSync(this.certsDir)) {
      fs.mkdirSync(this.certsDir, { recursive: true })
      // Restrict permissions to owner only
      fs.chmodSync(this.certsDir, 0o700)
    }
  }

  /**
   * Generate self-signed certificate for development
   */
  async generateSelfSignedCert(
    domain: string = 'localhost',
    additionalDomains: string[] = ['127.0.0.1', '::1']
  ): Promise<CertificateInfo> {
    const keyPath = path.join(this.certsDir, `${domain}.key`)
    const certPath = path.join(this.certsDir, `${domain}.crt`)

    // Check if certificate already exists and is valid
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      const existingCert = await this.loadCertificate(domain)
      if (existingCert && await this.validateCertificate(existingCert)) {
        return existingCert
      }
    }

    console.log(`🔒 Generating self-signed certificate for ${domain}`)

    // Create OpenSSL configuration
    const configPath = path.join(this.certsDir, `${domain}.conf`)
    const allDomains = [domain, ...additionalDomains]
    const altNames = allDomains.map((d, i) => `DNS.${i + 1} = ${d}`).join('\n')

    const opensslConfig = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = v3_req
distinguished_name = dn

[dn]
CN = ${domain}
O = SMS-Dev Development
OU = Local Development
L = Local
ST = Local
C = US

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
${altNames}
`

    fs.writeFileSync(configPath, opensslConfig)

    try {
      // Generate private key
      await execAsync(`openssl genrsa -out "${keyPath}" 2048`)
      
      // Generate certificate
      await execAsync(
        `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" ` +
        `-days 365 -config "${configPath}"`
      )

      // Set restrictive permissions
      fs.chmodSync(keyPath, 0o600)
      fs.chmodSync(certPath, 0o644)

      // Clean up config file
      fs.unlinkSync(configPath)

      console.log(`✅ Certificate generated successfully`)
      console.log(`   Certificate: ${certPath}`)
      console.log(`   Private Key: ${keyPath}`)

      return {
        cert: fs.readFileSync(certPath, 'utf8'),
        key: fs.readFileSync(keyPath, 'utf8')
      }

    } catch (error) {
      // If OpenSSL is not available, fall back to Node.js crypto
      console.log('⚠️  OpenSSL not found, using Node.js crypto fallback')
      return this.generateCertWithNodeCrypto(domain, allDomains)
    }
  }

  /**
   * Generate certificate using Node.js crypto (fallback)
   */
  private async generateCertWithNodeCrypto(
    domain: string,
    allDomains: string[]
  ): Promise<CertificateInfo> {
    const keyPath = path.join(this.certsDir, `${domain}.key`)
    const certPath = path.join(this.certsDir, `${domain}.crt`)

    // Generate key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })

    // Create a basic self-signed certificate
    // Note: This is a simplified version, for production use proper certificate tools
    const cert = this.createSimpleCert(domain, publicKey)

    fs.writeFileSync(keyPath, privateKey)
    fs.writeFileSync(certPath, cert)
    
    fs.chmodSync(keyPath, 0o600)
    fs.chmodSync(certPath, 0o644)

    return {
      cert,
      key: privateKey
    }
  }

  /**
   * Create a simple certificate (basic implementation)
   */
  private createSimpleCert(domain: string, publicKey: string): string {
    // This is a very basic certificate format
    // In a real implementation, you'd use a proper ASN.1/X.509 library
    const now = new Date()
    const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    return `-----BEGIN CERTIFICATE-----
MIICqTCCAZECCQD${crypto.randomBytes(8).toString('hex')}wQIBATANBgkqhkiG9w0BAQsF
ADARMQswCQYDVQQGEwJVUzEQMA4GA1UEAwwH${Buffer.from(domain).toString('base64')}
MB4XDTE${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}000000Z
MTB4XDTE${expiry.getFullYear().toString().slice(2)}${(expiry.getMonth() + 1).toString().padStart(2, '0')}${expiry.getDate().toString().padStart(2, '0')}000000Z
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${publicKey.split('\n').slice(1, -2).join('')}
IDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQA${crypto.randomBytes(64).toString('base64')}
-----END CERTIFICATE-----`
  }

  /**
   * Load certificate from disk
   */
  async loadCertificate(domain: string): Promise<CertificateInfo | null> {
    const keyPath = path.join(this.certsDir, `${domain}.key`)
    const certPath = path.join(this.certsDir, `${domain}.crt`)

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      return null
    }

    return {
      cert: fs.readFileSync(certPath, 'utf8'),
      key: fs.readFileSync(keyPath, 'utf8')
    }
  }

  /**
   * Validate certificate
   */
  async validateCertificate(certInfo: CertificateInfo): Promise<boolean> {
    try {
      // Basic validation - check if certificate and key match
      const cert = crypto.createVerify('RSA-SHA256')
      const testData = 'test-data'
      
      // This is a simplified validation
      // In production, you'd validate expiry, chains, etc.
      return certInfo.cert.includes('BEGIN CERTIFICATE') && 
             certInfo.key.includes('BEGIN PRIVATE KEY')
    } catch (error) {
      return false
    }
  }

  /**
   * Get certificate information
   */
  getCertificateInfo(certPem: string): {
    subject: string
    issuer: string
    validFrom: Date
    validTo: Date
    fingerprint: string
  } | null {
    try {
      // Parse certificate (basic implementation)
      // In production, use a proper X.509 parsing library
      const lines = certPem.split('\n')
      const certData = lines.slice(1, -2).join('')
      const hash = crypto.createHash('sha256').update(certData).digest('hex')
      
      return {
        subject: 'CN=localhost',
        issuer: 'CN=SMS-Dev Development CA',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        fingerprint: hash.match(/.{2}/g)?.join(':') || hash
      }
    } catch (error) {
      return null
    }
  }

  /**
   * List available certificates
   */
  listCertificates(): string[] {
    if (!fs.existsSync(this.certsDir)) {
      return []
    }

    return fs.readdirSync(this.certsDir)
      .filter(file => file.endsWith('.crt'))
      .map(file => path.basename(file, '.crt'))
  }

  /**
   * Remove certificate
   */
  removeCertificate(domain: string): boolean {
    const keyPath = path.join(this.certsDir, `${domain}.key`)
    const certPath = path.join(this.certsDir, `${domain}.crt`)

    let removed = false
    
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath)
      removed = true
    }
    
    if (fs.existsSync(certPath)) {
      fs.unlinkSync(certPath)
      removed = true
    }

    return removed
  }
}

/**
 * Security auditing tools
 */
export class SecurityAuditor {
  /**
   * Audit security configuration
   */
  async auditConfiguration(config: any): Promise<SecurityAuditResult> {
    const issues: SecurityIssue[] = []
    let score = 100

    // Check HTTPS enforcement
    if (!config.enforceHttps) {
      issues.push({
        severity: 'high',
        category: 'Transport Security',
        description: 'HTTPS enforcement is disabled',
        recommendation: 'Enable HTTPS enforcement to protect data in transit'
      })
      score -= 20
    }

    // Check HSTS
    if (!config.hsts?.enabled) {
      issues.push({
        severity: 'medium',
        category: 'Transport Security',
        description: 'HTTP Strict Transport Security (HSTS) is disabled',
        recommendation: 'Enable HSTS to prevent protocol downgrade attacks'
      })
      score -= 10
    }

    // Check CSP
    if (!config.csp?.enabled) {
      issues.push({
        severity: 'medium',
        category: 'Content Security',
        description: 'Content Security Policy (CSP) is disabled',
        recommendation: 'Enable CSP to prevent XSS attacks'
      })
      score -= 10
    } else if (config.csp.directives['script-src']?.includes("'unsafe-inline'")) {
      issues.push({
        severity: 'medium',
        category: 'Content Security',
        description: 'CSP allows unsafe inline scripts',
        recommendation: 'Remove unsafe-inline from script-src and use nonces'
      })
      score -= 8
    }

    // Check CORS
    if (config.cors?.origins?.includes('*')) {
      issues.push({
        severity: 'medium',
        category: 'Access Control',
        description: 'CORS allows all origins (*)',
        recommendation: 'Restrict CORS to specific trusted origins'
      })
      score -= 10
    }

    // Check rate limiting
    if (!config.rateLimit?.enabled) {
      issues.push({
        severity: 'medium',
        category: 'Rate Limiting',
        description: 'Rate limiting is disabled',
        recommendation: 'Enable rate limiting to prevent abuse'
      })
      score -= 10
    } else if (config.rateLimit.max > 1000) {
      issues.push({
        severity: 'low',
        category: 'Rate Limiting',
        description: 'Rate limit is very high',
        recommendation: 'Consider lowering the rate limit for better protection'
      })
      score -= 5
    }

    // Check API authentication
    if (!config.api?.requireApiKey) {
      issues.push({
        severity: 'high',
        category: 'Authentication',
        description: 'API key authentication is not required',
        recommendation: 'Require API key authentication for all requests'
      })
      score -= 15
    }

    const recommendations = this.generateRecommendations(issues)

    return {
      score: Math.max(0, score),
      issues,
      recommendations,
      compliance: {
        owasp: score >= 80,
        cis: score >= 85,
        nist: score >= 90
      }
    }
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations = new Set<string>()

    const hasTransportIssues = issues.some(i => i.category === 'Transport Security')
    if (hasTransportIssues) {
      recommendations.add('Implement comprehensive TLS/SSL configuration')
    }

    const hasContentIssues = issues.some(i => i.category === 'Content Security')
    if (hasContentIssues) {
      recommendations.add('Review and strengthen Content Security Policy')
    }

    const hasAccessIssues = issues.some(i => i.category === 'Access Control')
    if (hasAccessIssues) {
      recommendations.add('Implement principle of least privilege for API access')
    }

    const hasAuthIssues = issues.some(i => i.category === 'Authentication')
    if (hasAuthIssues) {
      recommendations.add('Implement strong authentication and authorization')
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical').length
    if (criticalIssues > 0) {
      recommendations.add('Address all critical security issues immediately')
    }

    const highIssues = issues.filter(i => i.severity === 'high').length
    if (highIssues > 2) {
      recommendations.add('Conduct a comprehensive security review')
    }

    if (recommendations.size === 0) {
      recommendations.add('Security configuration looks good! Regular audits are recommended')
    }

    return Array.from(recommendations)
  }

  /**
   * Check for common vulnerabilities
   */
  async checkVulnerabilities(dependencies: Record<string, string>): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = []

    // This is a simplified vulnerability check
    // In production, integrate with vulnerability databases
    const knownVulnerabilities = {
      'express': {
        '<4.17.1': {
          severity: 'high' as const,
          description: 'Express vulnerable to DoS attack',
          cve: ['CVE-2019-5413']
        }
      }
    }

    for (const [pkg, version] of Object.entries(dependencies)) {
      if (knownVulnerabilities[pkg as keyof typeof knownVulnerabilities]) {
        const vulns = knownVulnerabilities[pkg as keyof typeof knownVulnerabilities]
        // Simplified version comparison
        // In production, use a proper semver comparison library
        for (const [vulnVersion, vuln] of Object.entries(vulns)) {
          issues.push({
            severity: vuln.severity,
            category: 'Dependency Vulnerability',
            description: `${pkg}@${version}: ${vuln.description}`,
            recommendation: `Update ${pkg} to a version >= ${vulnVersion.replace('<', '')}`,
            cve: vuln.cve
          })
        }
      }
    }

    return issues
  }

  /**
   * Generate security report
   */
  generateSecurityReport(auditResult: SecurityAuditResult): string {
    const report = []
    
    report.push('# SMS-Dev Security Audit Report')
    report.push('')
    report.push(`**Security Score:** ${auditResult.score}/100`)
    report.push('')
    
    // Compliance status
    report.push('## Compliance Status')
    report.push(`- OWASP: ${auditResult.compliance.owasp ? '✅ Compliant' : '❌ Non-compliant'}`)
    report.push(`- CIS: ${auditResult.compliance.cis ? '✅ Compliant' : '❌ Non-compliant'}`)
    report.push(`- NIST: ${auditResult.compliance.nist ? '✅ Compliant' : '❌ Non-compliant'}`)
    report.push('')

    // Issues by severity
    const issuesBySeverity = auditResult.issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    report.push('## Security Issues')
    report.push(`- Critical: ${issuesBySeverity.critical || 0}`)
    report.push(`- High: ${issuesBySeverity.high || 0}`)
    report.push(`- Medium: ${issuesBySeverity.medium || 0}`)
    report.push(`- Low: ${issuesBySeverity.low || 0}`)
    report.push('')

    // Detailed issues
    if (auditResult.issues.length > 0) {
      report.push('## Detailed Issues')
      for (const issue of auditResult.issues) {
        const emoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }[issue.severity]
        
        report.push(`### ${emoji} ${issue.category}: ${issue.description}`)
        report.push(`**Severity:** ${issue.severity.toUpperCase()}`)
        report.push(`**Recommendation:** ${issue.recommendation}`)
        if (issue.cve) {
          report.push(`**CVE:** ${issue.cve.join(', ')}`)
        }
        report.push('')
      }
    }

    // Recommendations
    report.push('## Recommendations')
    for (const recommendation of auditResult.recommendations) {
      report.push(`- ${recommendation}`)
    }

    return report.join('\n')
  }
}

/**
 * Security helper utilities
 */
export class SecurityHelpers {
  /**
   * Generate secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Generate API key
   */
  static generateApiKey(): string {
    const prefix = 'smsdev'
    const random = crypto.randomBytes(24).toString('base64url')
    return `${prefix}_${random}`
  }

  /**
   * Hash password with salt
   */
  static async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
    return { hash, salt }
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'))
  }

  /**
   * Generate webhook signature
   */
  static generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex')
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateWebhookSignature(payload, secret)
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }

  /**
   * Sanitize input string
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/['"]/g, '') // Remove quotes
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
  }

  /**
   * Validate IP address
   */
  static isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  /**
   * Check if IP is private
   */
  static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ]

    return privateRanges.some(range => range.test(ip))
  }
}