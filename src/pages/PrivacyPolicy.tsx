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

export default function PrivacyPolicy() {
  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/" style={s.logo}>Clipmvp</Link>

        <h1 style={s.h1}>Privacy Policy</h1>
        <p style={s.meta}>
          Effective Date: <strong style={s.metaStrong}>January 1, 2025</strong>
          &nbsp;·&nbsp;
          Last Updated: <strong style={s.metaStrong}>March 30, 2026</strong>
        </p>

        <p style={s.p}>
          Welcome to Clipmvp. We are committed to protecting your personal information and your right to
          privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you use our platform and services.
        </p>
        <p style={s.p}>
          Please read this policy carefully. If you disagree with its terms, please discontinue use of our
          services.
        </p>

        <h2 style={s.h2}>1. Information We Collect</h2>
        <p style={s.p}>
          We collect information that you provide directly to us and information collected automatically when
          you use our services.
        </p>

        <p style={s.p}><strong style={s.strong}>Information you provide:</strong></p>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Name</strong> — collected when you create an account or complete your profile.</li>
          <li style={s.li}><strong style={s.strong}>Email address</strong> — used to create and manage your account, send notifications, and communicate with you.</li>
          <li style={s.li}><strong style={s.strong}>Payment information</strong> — collected when you subscribe to a paid plan. Payment data is processed by a third-party payment processor and we do not store full card details on our servers.</li>
        </ul>

        <p style={s.p}><strong style={s.strong}>Information collected automatically:</strong></p>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Usage and analytics data</strong> — including pages visited, features used, session duration, device type, browser type, IP address, and referring URLs. This helps us understand how our platform is used and improve the experience.</li>
          <li style={s.li}><strong style={s.strong}>Cookies and tracking technologies</strong> — we use cookies and similar technologies to maintain your session, remember your preferences, and collect analytics data.</li>
        </ul>

        <h2 style={s.h2}>2. How We Use Your Information</h2>
        <p style={s.p}>We use the information we collect for the following purposes:</p>
        <ul style={s.ul}>
          <li style={s.li}>To create and manage your account</li>
          <li style={s.li}>To process payments and manage subscriptions</li>
          <li style={s.li}>To provide, maintain, and improve our services</li>
          <li style={s.li}>To send you service-related emails and notifications</li>
          <li style={s.li}>To respond to your comments, questions, and requests</li>
          <li style={s.li}>To monitor and analyze usage trends and platform performance</li>
          <li style={s.li}>To detect, prevent, and address technical issues or fraudulent activity</li>
          <li style={s.li}>To comply with legal obligations</li>
        </ul>

        <h2 style={s.h2}>3. How We Share Your Information</h2>
        <p style={s.p}>We do not sell your personal information. We may share your information in the following limited circumstances:</p>
        <ul style={s.ul}>
          <li style={s.li}><strong style={s.strong}>Service providers</strong> — trusted third-party vendors who help us operate our platform (e.g. payment processors, cloud hosting, analytics tools). These parties are contractually obligated to protect your data.</li>
          <li style={s.li}><strong style={s.strong}>Legal requirements</strong> — if required by law, subpoena, or other legal process, or to protect the rights, property, or safety of Clipmvp, our users, or others.</li>
          <li style={s.li}><strong style={s.strong}>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</li>
        </ul>

        <h2 style={s.h2}>4. Data Retention</h2>
        <p style={s.p}>
          We retain your personal information for as long as your account is active or as needed to provide our
          services. You may request deletion of your account and associated data at any time by contacting us.
          We may retain certain information as required by law or for legitimate business purposes.
        </p>

        <h2 style={s.h2}>5. Your Rights</h2>
        <p style={s.p}>As a user based in the United States, you have the following rights regarding your data:</p>
        <ul style={s.ul}>
          <li style={s.li}>The right to access the personal information we hold about you</li>
          <li style={s.li}>The right to correct inaccurate or incomplete information</li>
          <li style={s.li}>The right to request deletion of your personal information</li>
          <li style={s.li}>The right to opt out of marketing communications at any time</li>
          <li style={s.li}>The right to data portability where technically feasible</li>
        </ul>
        <p style={s.p}>To exercise any of these rights, please contact us at the email address below.</p>

        <h2 style={s.h2}>6. Data Security</h2>
        <p style={s.p}>
          We implement industry-standard security measures to protect your personal information, including
          encryption in transit (TLS/SSL) and access controls. However, no method of transmission over the
          internet is 100% secure and we cannot guarantee absolute security.
        </p>

        <h2 style={s.h2}>7. Children's Privacy</h2>
        <p style={s.p}>
          Clipmvp is not directed to children under the age of 13. We do not knowingly collect personal
          information from children under 13. If we learn that we have collected such information, we will take
          steps to delete it promptly.
        </p>

        <h2 style={s.h2}>8. Third-Party Links</h2>
        <p style={s.p}>
          Our platform may contain links to third-party websites or services. We are not responsible for the
          privacy practices of those third parties and encourage you to review their privacy policies.
        </p>

        <h2 style={s.h2}>9. Changes to This Policy</h2>
        <p style={s.p}>
          We may update this Privacy Policy from time to time. When we do, we will revise the "Last Updated"
          date at the top of this page. We encourage you to review this policy periodically. Continued use of
          our services after changes constitutes your acceptance of the updated policy.
        </p>

        <h2 style={s.h2}>10. Contact Us</h2>
        <p style={s.p}>If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
        <div style={s.highlight}>
          <strong style={s.strong}>Clipmvp</strong><br />
          Email: <span style={s.placeholder}>legal@clipmvp.com [replace with your email]</span><br />
          Website: <span style={s.placeholder}>www.clipmvp.com [replace with your domain]</span>
        </div>

        <footer style={s.footer}>
          &copy; 2026 Clipmvp. All rights reserved. &nbsp;·&nbsp;
          <Link to="/terms" style={s.a}>Terms of Service</Link>
        </footer>
      </div>
    </div>
  );
}
