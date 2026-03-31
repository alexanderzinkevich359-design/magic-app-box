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
  ol: { color: "#B0B0B0", paddingLeft: "1.5rem", marginBottom: "1rem" } as React.CSSProperties,
  li: { marginBottom: "0.6rem" } as React.CSSProperties,
  highlight: {
    background: "#1A1A1A",
    border: "0.5px solid #2A2A2A",
    borderRadius: "10px",
    padding: "1.25rem 1.5rem",
    margin: "1rem 0",
    color: "#B0B0B0",
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

export default function DataDeletion() {
  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/" style={s.logo}>Clipmvp</Link>

        <h1 style={s.h1}>Data Deletion Instructions</h1>
        <p style={s.meta}>
          Last Updated: <strong style={s.metaStrong}>March 31, 2026</strong>
        </p>

        <p style={s.p}>
          If you have connected your Facebook or Instagram account to Clipmvp and would like to
          request deletion of your data, you can do so by following the steps below.
        </p>

        <h2 style={s.h2}>How to Request Data Deletion</h2>
        <ol style={s.ol}>
          <li style={s.li}>
            Send an email to <a href="mailto:legal@clipmvp.com" style={s.a}>legal@clipmvp.com</a> with
            the subject line <strong style={s.strong}>"Data Deletion Request"</strong>.
          </li>
          <li style={s.li}>
            Include the email address associated with your Clipmvp account so we can locate your data.
          </li>
          <li style={s.li}>
            We will process your request within <strong style={s.strong}>30 days</strong> and send a
            confirmation once your data has been deleted.
          </li>
        </ol>

        <h2 style={s.h2}>What Gets Deleted</h2>
        <p style={s.p}>Upon a confirmed deletion request, we will remove:</p>
        <ol style={s.ol}>
          <li style={s.li}>Your Clipmvp account and profile information</li>
          <li style={s.li}>Any social connection tokens (Facebook / Instagram access tokens) stored by Clipmvp</li>
          <li style={s.li}>Any posts, media, or content associated with your account</li>
          <li style={s.li}>All personal data we hold on your behalf</li>
        </ol>
        <p style={s.p}>
          We may retain certain information where required by law or for legitimate business purposes
          (e.g. billing records), as described in our{" "}
          <Link to="/privacy" style={s.a}>Privacy Policy</Link>.
        </p>

        <h2 style={s.h2}>Revoking Facebook / Instagram Access</h2>
        <p style={s.p}>
          You can also revoke Clipmvp's access to your Facebook or Instagram account at any time
          directly through Facebook's settings:
        </p>
        <div style={s.highlight}>
          Facebook Settings → Security &amp; Login → Apps and Websites → find <strong style={s.strong}>Clipmvp</strong> → Remove
        </div>
        <p style={s.p}>
          Revoking access in Facebook does not delete your Clipmvp account or data. To fully delete
          your data, please also send a deletion request to the email above.
        </p>

        <h2 style={s.h2}>Contact Us</h2>
        <p style={s.p}>If you have questions about data deletion, please contact us at:</p>
        <div style={s.highlight}>
          <strong style={s.strong}>Clipmvp</strong><br />
          Email: <a href="mailto:legal@clipmvp.com" style={s.a}>legal@clipmvp.com</a><br />
          Website: <a href="https://www.clipmvp.com" style={s.a}>www.clipmvp.com</a>
        </div>

        <footer style={s.footer}>
          &copy; 2026 Clipmvp. All rights reserved. &nbsp;·&nbsp;
          <Link to="/privacy" style={s.a}>Privacy Policy</Link>
          &nbsp;·&nbsp;
          <Link to="/terms" style={s.a}>Terms of Service</Link>
        </footer>
      </div>
    </div>
  );
}
