import { Link } from "react-router-dom";

const s = {
  page: {
    background: "#0D0D0D",
    minHeight: "100vh",
    color: "#E0E0E0",
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    fontSize: "15px",
    lineHeight: "1.8",
    padding: "3rem 1.5rem",
  } as React.CSSProperties,
  container: { maxWidth: "760px", margin: "0 auto" } as React.CSSProperties,
  logo: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "#CC1111",
    marginBottom: "2.5rem",
    display: "block",
    textDecoration: "none",
  } as React.CSSProperties,
  h1: { fontSize: "32px", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" } as React.CSSProperties,
  meta: {
    fontSize: "13px",
    color: "#555",
    marginBottom: "3rem",
    paddingBottom: "2rem",
    borderBottom: "0.5px solid #222",
  } as React.CSSProperties,
  h2: {
    fontSize: "17px",
    fontWeight: 700,
    color: "#fff",
    margin: "2.5rem 0 0.75rem",
    paddingLeft: "0.75rem",
    borderLeft: "3px solid #CC1111",
  } as React.CSSProperties,
  p: { color: "#B0B0B0", marginBottom: "1rem" } as React.CSSProperties,
  ul: { color: "#B0B0B0", paddingLeft: "1.5rem", marginBottom: "1rem" } as React.CSSProperties,
  li: { marginBottom: "0.4rem" } as React.CSSProperties,
  highlight: {
    background: "#1A1A1A",
    border: "0.5px solid #2A2A2A",
    borderRadius: "10px",
    padding: "1.25rem 1.5rem",
    margin: "1rem 0",
    color: "#B0B0B0",
  } as React.CSSProperties,
  placeholder: {
    background: "#2A1010",
    border: "0.5px solid #CC1111",
    borderRadius: "6px",
    padding: "0.2rem 0.5rem",
    fontSize: "13px",
    color: "#FF6666",
  } as React.CSSProperties,
  footer: {
    marginTop: "4rem",
    paddingTop: "2rem",
    borderTop: "0.5px solid #222",
    fontSize: "12px",
    color: "#444",
    textAlign: "center" as const,
  } as React.CSSProperties,
  a: { color: "#CC1111", textDecoration: "none" } as React.CSSProperties,
  strong: { color: "#fff" },
  metaStrong: { color: "#888" },
};

export default function TermsOfService() {
  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/" style={s.logo}>Clipmvp</Link>

        <h1 style={s.h1}>Terms of Service</h1>
        <p style={s.meta}>
          Effective Date: <strong style={s.metaStrong}>January 1, 2025</strong>
          &nbsp;·&nbsp;
          Last Updated: <strong style={s.metaStrong}>March 30, 2026</strong>
        </p>

        <p style={s.p}>
          These Terms of Service ("Terms") govern your access to and use of the Clipmvp platform, website, and
          services ("Services") provided by Clipmvp ("we," "us," or "our"). By accessing or using our Services,
          you agree to be bound by these Terms. If you do not agree, do not use our Services.
        </p>

        <h2 style={s.h2}>1. Eligibility</h2>
        <p style={s.p}>
          You must be at least 13 years of age to use Clipmvp. By using our Services, you represent and warrant
          that you meet this requirement. If you are using the Services on behalf of an organization, you represent
          that you have the authority to bind that organization to these Terms.
        </p>

        <h2 style={s.h2}>2. Accounts</h2>
        <p style={s.p}>To access certain features of Clipmvp, you must create an account. You agree to:</p>
        <ul style={s.ul}>
          <li style={s.li}>Provide accurate, current, and complete information during registration</li>
          <li style={s.li}>Keep your account credentials secure and confidential</li>
          <li style={s.li}>Notify us immediately of any unauthorized access to your account</li>
          <li style={s.li}>Be responsible for all activity that occurs under your account</li>
        </ul>
        <p style={s.p}>We reserve the right to suspend or terminate accounts that violate these Terms.</p>

        <h2 style={s.h2}>3. Use of Services</h2>
        <p style={s.p}>
          Clipmvp grants you a limited, non-exclusive, non-transferable, revocable license to use our Services
          for your personal or internal business purposes, subject to these Terms.
        </p>
        <p style={s.p}>You agree not to:</p>
        <ul style={s.ul}>
          <li style={s.li}>Use the Services for any unlawful purpose or in violation of any applicable laws</li>
          <li style={s.li}>Reproduce, duplicate, copy, sell, or resell any part of our Services without our express written permission</li>
          <li style={s.li}>Upload or transmit viruses, malware, or any other harmful code</li>
          <li style={s.li}>Attempt to gain unauthorized access to any part of our Services or systems</li>
          <li style={s.li}>Interfere with or disrupt the integrity or performance of the Services</li>
          <li style={s.li}>Scrape, crawl, or use automated means to access data from our platform</li>
          <li style={s.li}>Impersonate another person or entity</li>
        </ul>

        <h2 style={s.h2}>4. Subscriptions and Payments</h2>
        <p style={s.p}>
          Certain features of Clipmvp require a paid subscription. By subscribing, you agree to pay all
          applicable fees as described at the time of purchase.
        </p>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Billing</strong> — subscriptions are billed on a recurring basis (monthly or annually) until cancelled.</li>
          <li style={s.li}><strong style={s.strong}>Cancellation</strong> — you may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
          <li style={s.li}><strong style={s.strong}>Refunds</strong> — all fees are non-refundable except as required by law or as expressly stated in our refund policy.</li>
          <li style={s.li}><strong style={s.strong}>Price changes</strong> — we reserve the right to change our pricing. We will provide reasonable notice of any price changes before they take effect.</li>
        </ul>

        <h2 style={s.h2}>5. User Content</h2>
        <p style={s.p}>
          You retain ownership of any content you upload or submit to Clipmvp ("User Content"). By submitting
          User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, display,
          and process your content solely to provide and improve the Services.
        </p>
        <p style={s.p}>
          You represent and warrant that your User Content does not violate any third-party rights, including
          intellectual property rights, and complies with all applicable laws.
        </p>

        <h2 style={s.h2}>6. Intellectual Property</h2>
        <p style={s.p}>
          All content, features, and functionality of the Clipmvp platform — including but not limited to text,
          graphics, logos, and software — are the exclusive property of Clipmvp and are protected by applicable
          intellectual property laws. You may not use our branding or intellectual property without our prior
          written consent.
        </p>

        <h2 style={s.h2}>7. Disclaimer of Warranties</h2>
        <p style={s.p}>
          THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
          OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p style={s.p}>
          We do not warrant that the Services will be uninterrupted, error-free, or free of harmful components.
        </p>

        <h2 style={s.h2}>8. Limitation of Liability</h2>
        <p style={s.p}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CLIPMVP SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR
          GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES.
        </p>
        <p style={s.p}>
          OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU
          PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
        </p>

        <h2 style={s.h2}>9. Indemnification</h2>
        <p style={s.p}>
          You agree to indemnify, defend, and hold harmless Clipmvp and its officers, directors, employees, and
          agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable
          legal fees, arising out of or in any way connected with your access to or use of the Services, your
          User Content, or your violation of these Terms.
        </p>

        <h2 style={s.h2}>10. Termination</h2>
        <p style={s.p}>
          We may suspend or terminate your access to the Services at any time, with or without cause or notice,
          including if we believe you have violated these Terms. Upon termination, your right to use the Services
          will immediately cease. Provisions of these Terms that by their nature should survive termination will
          survive.
        </p>

        <h2 style={s.h2}>11. Governing Law</h2>
        <p style={s.p}>
          These Terms are governed by and construed in accordance with the laws of the{" "}
          <span style={s.placeholder}>State of [Your State] [replace]</span>, United States, without regard to
          its conflict of law provisions. Any disputes arising under these Terms shall be subject to the
          exclusive jurisdiction of the courts located in{" "}
          <span style={s.placeholder}>[Your City, State] [replace]</span>.
        </p>

        <h2 style={s.h2}>12. Changes to These Terms</h2>
        <p style={s.p}>
          We reserve the right to modify these Terms at any time. When we do, we will update the "Last Updated"
          date at the top of this page and, where appropriate, notify you by email or in-app notification. Your
          continued use of the Services after changes constitutes acceptance of the updated Terms.
        </p>

        <h2 style={s.h2}>13. Contact Us</h2>
        <p style={s.p}>If you have questions about these Terms, please contact us at:</p>
        <div style={s.highlight}>
          <strong style={s.strong}>Clipmvp</strong><br />
          Email: <span style={s.placeholder}>legal@clipmvp.com [replace with your email]</span><br />
          Website: <span style={s.placeholder}>www.clipmvp.com [replace with your domain]</span>
        </div>

        <footer style={s.footer}>
          &copy; 2026 Clipmvp. All rights reserved. &nbsp;·&nbsp;
          <Link to="/privacy" style={s.a}>Privacy Policy</Link>
        </footer>
      </div>
    </div>
  );
}
